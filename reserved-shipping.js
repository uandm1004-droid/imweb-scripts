(function ($) {
  'use strict';

  var BADGE_TEXT = '예약배송';
  var RENDER_DELAY = 150;

  var skuCache = {};
  var pendingCache = {};
  var renderTimer = null;

  function normalize(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /*
   * 아임웹 onclick에서 옵션 데이터 추출
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
   * 옵션 영역 제목 확인
   */
  function getWrapTitle($wrap) {
    var $column = $wrap.closest(
      '.col-xs-12, .col-md-12, ._form_parent'
    );

    var $title = $column
      .find('.option_title')
      .first()
      .clone();

    $title.children().remove();

    return normalize($title.text());
  }

  function isColorWrap($wrap) {
    var title = getWrapTitle($wrap);

    return (
      title.indexOf('컬러') !== -1 ||
      title.indexOf('색상') !== -1
    );
  }

  function isSizeWrap($wrap) {
    return getWrapTitle($wrap).indexOf('사이즈') !== -1;
  }

  /*
   * PC·모바일 전체 옵션 영역에서 현재 선택된 컬러 확인
   */
  function getSelectedColor() {
    var selectedColor = null;

    $('.form-select-wrap').each(function () {
      var $wrap = $(this);

      if (!isColorWrap($wrap)) {
        return;
      }

      var selectedName = normalize(
        $wrap.find('.dropdown-toggle').first().text()
      );

      if (
        !selectedName ||
        selectedName === '컬러' ||
        selectedName === '색상' ||
        selectedName.indexOf('필수') !== -1
      ) {
        return;
      }

      /*
       * selected 클래스가 있는 컬러값 우선
       */
      var $selectedItem = $wrap
        .find('.dropdown-item.selected')
        .first();

      var selectedData = parseOption(
        $selectedItem
          .find('[onclick*="selectRequireOption"]')
          .first()
      );

      if (selectedData) {
        selectedColor = selectedData;
        return false;
      }

      /*
       * 드롭다운 표시 텍스트와 같은 컬러값 찾기
       */
      $wrap.find('.dropdown-item').each(function () {
        var optionData = parseOption(
          $(this)
            .find('[onclick*="selectRequireOption"]')
            .first()
        );

        if (
          optionData &&
          normalize(optionData.valueName) === selectedName
        ) {
          selectedColor = optionData;
          return false;
        }
      });

      if (selectedColor) {
        return false;
      }
    });

    return selectedColor;
  }

  /*
   * 예약배송 문구인지 확인
   */
  function isReservedSku(skuNo) {
    skuNo = normalize(skuNo);

    return (
      skuNo.indexOf('발송') !== -1 ||
      skuNo.indexOf('배송') !== -1 ||
      skuNo.indexOf('예약') !== -1
    );
  }

  /*
   * select_option.cm 요청 데이터
   */
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

  /*
   * 컬러 + 사이즈 조합별 SKU 조회
   */
  function getSku(color, size) {
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
   * 예약배송 문구 삽입
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
      return;
    }

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
   * 모든 PC·모바일 사이즈 목록 처리
   */
  function renderReservedShipping() {
    var color = getSelectedColor();

    if (!color) {
      return;
    }

    $('.form-select-wrap').each(function () {
      var $sizeWrap = $(this);

      if (!isSizeWrap($sizeWrap)) {
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

          getSku(color, size).done(function (skuNo) {
            /*
             * 현재 DOM에서 같은 옵션 행 다시 찾기
             */
            var $currentItem = $();

            $('.form-select-wrap').each(function () {
              var $currentWrap = $(this);

              if (!isSizeWrap($currentWrap)) {
                return;
              }

              $currentWrap
                .find('.dropdown-item')
                .each(function () {
                  var $candidate = $(this);

                  var candidate = parseOption(
                    $candidate
                      .find('[onclick*="selectRequireOption"]')
                      .first()
                  );

                  if (
                    candidate &&
                    candidate.prodIdx === size.prodIdx &&
                    candidate.valueCode === size.valueCode
                  ) {
                    /*
                     * PC와 모바일에 동일 옵션 행이 모두 존재할 수 있어
                     * 발견한 모든 행에 적용
                     */
                    insertMessage(
                      $candidate,
                      skuNo,
                      key
                    );
                  }
                });
            });
          });
        });
    });
  }

  function scheduleRender() {
    clearTimeout(renderTimer);

    renderTimer = setTimeout(
      renderReservedShipping,
      RENDER_DELAY
    );
  }

  /*
   * 옵션 클릭 후 아임웹 HTML 갱신 대응
   */
  $(document).on(
    'click',
    '.form-select-wrap .dropdown-item, ' +
    '.form-select-wrap .dropdown-toggle',
    function () {
      scheduleRender();
      setTimeout(scheduleRender, 300);
      setTimeout(scheduleRender, 700);
      setTimeout(scheduleRender, 1200);
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

  /*
   * 모바일 옵션창이 나중에 생성되는 경우 대응
   */
  var observer = new MutationObserver(function (
    mutations
  ) {
    var shouldRender = false;

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
            shouldRender = true;
          }
        }
      );
    });

    if (shouldRender) {
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
    setTimeout(scheduleRender, 1200);
  });

})(jQuery);
