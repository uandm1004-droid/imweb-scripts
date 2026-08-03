(function ($) {
  'use strict';

  var BADGE_TEXT = '예약배송';
  var skuCache = {};
  var pendingCache = {};
  var renderTimer = null;

  function normalize(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /*
   * onclick에서 상품·옵션 정보 추출
   */
  function parseOption($element) {
    if (!$element || !$element.length) {
      return null;
    }

    var onclick = $element.attr('onclick') || '';

    var match = onclick.match(
      /selectRequireOption\s*\(\s*['"]prod['"]\s*,\s*(\d+)\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/
    );

    if (!match) {
      return null;
    }

    return {
      prodIdx: match[1],
      optionCode: match[2],
      valueCode: match[3],
      valueName: match[4]
    };
  }

  /*
   * 드롭다운 상단에 표시되는 현재 값
   */
  function getToggleText($wrap) {
    return normalize(
      $wrap.find('> .dropdown-toggle').first().text()
    );
  }

  /*
   * 모바일·PC 사이즈 영역 판별
   *
   * 모바일은 option_title이 "필수옵션" 하나뿐이므로
   * dropdown-toggle의 "사이즈" 텍스트로 판별합니다.
   */
  function isSizeWrap($wrap) {
    var toggleText = getToggleText($wrap);

    if (toggleText.indexOf('사이즈') !== -1) {
      return true;
    }

    /*
     * 이미 사이즈가 선택돼 버튼에 M, L 등이 표시되는 구조 대응
     */
    var optionNames = [];

    $wrap.find('.dropdown-item').each(function () {
      var data = parseOption(
        $(this)
          .find('[onclick*="selectRequireOption"]')
          .first()
      );

      if (data) {
        optionNames.push(normalize(data.valueName));
      }
    });

    if (!optionNames.length) {
      return false;
    }

    var sizePattern =
      /^(XS|S|M|L|XL|XXL|XXXL|[2-9]XL|FREE|F|숏|롱|SHORT|LONG)$/i;

    var sizeCount = optionNames.filter(function (name) {
      return sizePattern.test(name);
    }).length;

    return sizeCount >= Math.ceil(optionNames.length / 2);
  }

  /*
   * 같은 옵션 박스에서 사이즈 영역 바로 앞의 컬러 영역 찾기
   */
  function findColorWrap($sizeWrap) {
    var $container = $sizeWrap.closest(
      '.goods_select, #prod_options, #goods_wrap'
    );

    if (!$container.length) {
      $container = $(document.body);
    }

    var $wraps = $container.find('.form-select-wrap');
    var sizeIndex = $wraps.index($sizeWrap);
    var $result = $();

    /*
     * 사이즈 앞쪽에서 가장 가까운 선택형 옵션 탐색
     */
    for (var i = sizeIndex - 1; i >= 0; i--) {
      var $candidate = $wraps.eq(i);
      var text = getToggleText($candidate);

      if (isSizeWrap($candidate)) {
        continue;
      }

      if (
        !text ||
        text.indexOf('사이즈') !== -1
      ) {
        continue;
      }

      /*
       * 컬러가 선택된 경우: 블랙, 그레이 등
       */
      if (
        text.indexOf('컬러') === -1 &&
        text.indexOf('색상') === -1 &&
        text.indexOf('필수') === -1
      ) {
        $result = $candidate;
        break;
      }

      /*
       * 선택 전 컬러 영역도 후보로 저장
       */
      if (!$result.length) {
        $result = $candidate;
      }
    }

    return $result;
  }

  /*
   * 컬러 영역에서 현재 선택된 컬러 데이터 확인
   */
  function getSelectedColor($colorWrap) {
    if (!$colorWrap || !$colorWrap.length) {
      return null;
    }

    var selectedData = null;

    /*
     * selected 클래스 우선
     */
    var $selected = $colorWrap
      .find('.dropdown-item.selected')
      .first()
      .find('[onclick*="selectRequireOption"]')
      .first();

    selectedData = parseOption($selected);

    if (selectedData) {
      return selectedData;
    }

    /*
     * 모바일은 dropdown-toggle에 "블랙"처럼 선택값 표시
     */
    var selectedName = getToggleText($colorWrap);

    if (
      !selectedName ||
      selectedName.indexOf('컬러') !== -1 ||
      selectedName.indexOf('색상') !== -1 ||
      selectedName.indexOf('필수') !== -1
    ) {
      return null;
    }

    $colorWrap.find('.dropdown-item').each(function () {
      var data = parseOption(
        $(this)
          .find('[onclick*="selectRequireOption"]')
          .first()
      );

      if (
        data &&
        normalize(data.valueName) === selectedName
      ) {
        selectedData = data;
        return false;
      }
    });

    return selectedData;
  }

  function isReservedSku(skuNo) {
    skuNo = normalize(skuNo);

    return (
      skuNo.indexOf('발송') !== -1 ||
      skuNo.indexOf('배송') !== -1 ||
      skuNo.indexOf('예약') !== -1
    );
  }

  function buildPayload(color, size) {
    return {
      prod_idx: size.prodIdx || color.prodIdx,

      'options[0][value_type]': 'SELECT',
      'options[0][option_code]': color.optionCode,
      'options[0][value_code]': color.valueCode,
      'options[0][value_name]': color.valueName,

      'options[1][value_type]': 'SELECT',
      'options[1][option_code]': size.optionCode,
      'options[1][value_code]': size.valueCode,
      'options[1][value_name]': size.valueName,

      require: 'Y',
      count: 1,
      idx: 0,
      skip_quantity_validation: false
    };
  }

  function requestSku(color, size) {
    var key = [
      size.prodIdx || color.prodIdx,
      color.valueCode,
      size.valueCode
    ].join('|');

    if (
      Object.prototype.hasOwnProperty.call(
        skuCache,
        key
      )
    ) {
      return $.Deferred()
        .resolve(skuCache[key])
        .promise();
    }

    if (pendingCache[key]) {
      return pendingCache[key];
    }

    var deferred = $.Deferred();

    pendingCache[key] = deferred.promise();

    $.ajax({
      url: '/shop/select_option.cm',
      type: 'POST',
      dataType: 'json',
      data: buildPayload(color, size)
    })
      .done(function (response) {
        var skuNo = '';

        if (
          response &&
          response.msg === 'SUCCESS' &&
          response.selected_option
        ) {
          skuNo = normalize(
            response.selected_option.sku_no
          );
        }

        skuCache[key] = skuNo;
        deferred.resolve(skuNo);
      })
      .fail(function () {
        deferred.resolve('');
      })
      .always(function () {
        delete pendingCache[key];
      });

    return deferred.promise();
  }

  /*
   * 사이즈 옵션 행에 문구 삽입
   */
  function insertMessage($item, skuNo, key) {
    $item.find('.reserved-shipping-text').remove();
    $item.removeClass('has-reserved-shipping');

    if (!isReservedSku(skuNo)) {
      $item
        .attr('data-reserved-key', key)
        .attr('data-reserved-loaded', 'true');

      return;
    }

    var $sizeName = $item
      .find('span.margin-bottom-lg')
      .first();

    if (!$sizeName.length) {
      $sizeName = $item
        .find('.tw-flex-row span.blocked')
        .filter(function () {
          var text = normalize($(this).text());

          return (
            text &&
            text.indexOf('남음') === -1 &&
            text.indexOf('품절') === -1
          );
        })
        .first();
    }

    if (!$sizeName.length) {
      return;
    }

    /*
     * 모바일 구조:
     *
     * a
     * ├─ low-stock-nudge-option
     * └─ div.tw-flex-row
     *     └─ div
     *         ├─ span 사이즈명
     *         └─ span
     *
     * 안쪽 div에 예약배송 문구 삽입
     */
    var $content = $sizeName.parent();

    if (!$content.length) {
      return;
    }

    $content.addClass('reserved-option-content');

    var $message = $('<span>', {
      class: 'reserved-shipping-text'
    });

    $('<span>', {
      class: 'reserved-shipping-date',
      text: skuNo
    }).appendTo($message);

    $('<span>', {
      class: 'reserved-shipping-badge',
      text: BADGE_TEXT
    }).appendTo($message);

    $content.append($message);

    $item
      .addClass('has-reserved-shipping')
      .attr('data-reserved-key', key)
      .attr('data-reserved-loaded', 'true');
  }

  /*
   * 모바일·PC 사이즈 영역 처리
   */
  function renderSizeWrap($sizeWrap) {
    var $colorWrap = findColorWrap($sizeWrap);
    var color = getSelectedColor($colorWrap);

    if (!color) {
      return;
    }

    $sizeWrap
      .find('.dropdown-item')
      .each(function () {
        var $item = $(this);

        var size = parseOption(
          $item
            .find('[onclick*="selectRequireOption"]')
            .first()
        );

        if (!size) {
          return;
        }

        if (
          String(size.prodIdx) !==
          String(color.prodIdx)
        ) {
          return;
        }

        var key = [
          color.valueCode,
          size.valueCode
        ].join('|');

        if (
          $item.attr('data-reserved-key') === key &&
          $item.attr('data-reserved-loaded') === 'true'
        ) {
          return;
        }

        $item.attr('data-reserved-key', key);

        requestSku(color, size).done(function (skuNo) {
          /*
           * AJAX 완료 시점에 DOM이 교체됐을 수 있어
           * 같은 사이즈 코드를 현재 영역에서 다시 탐색
           */
          $sizeWrap
            .find('.dropdown-item')
            .each(function () {
              var $currentItem = $(this);

              var currentSize = parseOption(
                $currentItem
                  .find('[onclick*="selectRequireOption"]')
                  .first()
              );

              if (
                currentSize &&
                currentSize.valueCode === size.valueCode
              ) {
                insertMessage(
                  $currentItem,
                  skuNo,
                  key
                );
              }
            });
        });
      });
  }

  function renderAll() {
    $('.form-select-wrap').each(function () {
      var $wrap = $(this);

      if (isSizeWrap($wrap)) {
        renderSizeWrap($wrap);
      }
    });
  }

  function scheduleRender() {
    clearTimeout(renderTimer);

    renderTimer = setTimeout(
      renderAll,
      120
    );
  }

  /*
   * 모바일 컬러 선택 후 옵션 HTML 교체 대응
   */
  $(document).on(
    'click',
    '.form-select-wrap .dropdown-item, ' +
    '.form-select-wrap .dropdown-toggle',
    function () {
      scheduleRender();
      setTimeout(scheduleRender, 250);
      setTimeout(scheduleRender, 600);
      setTimeout(scheduleRender, 1000);
    }
  );

  $(document).ajaxComplete(function (
    event,
    xhr,
    settings
  ) {
    if (
      settings &&
      settings.url &&
      settings.url.indexOf('load_option.cm') !== -1
    ) {
      scheduleRender();
      setTimeout(scheduleRender, 300);
    }
  });

  var observer = new MutationObserver(function (
    mutations
  ) {
    var changed = false;

    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(
        mutation.addedNodes || [],
        function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }

          if (
            $(node).hasClass(
              'reserved-shipping-text'
            )
          ) {
            return;
          }

          if (
            $(node).is(
              '.form-select-wrap, ' +
              '.dropdown-menu, ' +
              '.dropdown-item'
            ) ||
            $(node).find(
              '.form-select-wrap, ' +
              '.dropdown-menu, ' +
              '.dropdown-item'
            ).length
          ) {
            changed = true;
          }
        }
      );
    });

    if (changed) {
      scheduleRender();
    }
  });

  $(function () {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleRender();
    setTimeout(scheduleRender, 500);
    setTimeout(scheduleRender, 1000);
  });

})(jQuery);
