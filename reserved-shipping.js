(function ($) {
  'use strict';

  /*
   * 아임웹 조합형 옵션 예약배송 표시
   *
   * 상품관리의 재고번호(SKU)에
   * "08.10(월) 이후 순차 발송"처럼 입력하면,
   * 컬러 선택 후 각 사이즈 옵션 아래에
   * "08.10(월) 이후 순차 발송 예약배송"으로 표시됩니다.
   *
   * PC와 모바일 옵션 영역을 각각 찾아 처리합니다.
   */

  var CONFIG = {
    badgeText: '예약배송',
    skuKeywords: ['발송', '배송', '예약'],
    requestInterval: 80,
    renderDelay: 150
  };

  var skuCache = {};
  var pendingRequests = {};
  var renderTimer = null;

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /*
   * onclick 속성에서 옵션 정보를 추출합니다.
   */
  function parseOptionData($element) {
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
   * 옵션 영역의 제목을 가져옵니다.
   */
  function getOptionTitle($wrap) {
    if (!$wrap || !$wrap.length) {
      return '';
    }

    var $column = $wrap.closest(
      '.col-xs-12, .col-md-12, ._form_parent'
    );

    var $title = $column
      .find('.option_title')
      .first()
      .clone();

    $title.children().remove();

    return normalizeText($title.text());
  }

  function isColorWrap($wrap) {
    var title = getOptionTitle($wrap);

    return (
      title.indexOf('컬러') !== -1 ||
      title.indexOf('색상') !== -1
    );
  }

  function isSizeWrap($wrap) {
    return getOptionTitle($wrap).indexOf('사이즈') !== -1;
  }

  /*
   * 요소가 display:none 영역 안에 있는지 확인합니다.
   */
  function isHiddenWrap($wrap) {
    if (!$wrap || !$wrap.length) {
      return true;
    }

    if ($wrap.css('display') === 'none') {
      return true;
    }

    if ($wrap.closest('[style*="display: none"]').length) {
      return true;
    }

    return false;
  }

  /*
   * 컬러 드롭다운에 실제 선택값이 있는지 확인합니다.
   */
  function hasSelectedColorText($wrap) {
    var text = normalizeText(
      $wrap.find('.dropdown-toggle').first().text()
    );

    if (!text) {
      return false;
    }

    if (
      text.indexOf('필수') !== -1 ||
      text === '컬러' ||
      text === '색상'
    ) {
      return false;
    }

    return true;
  }

  /*
   * PC와 모바일의 사이즈 옵션 영역을 기준으로
   * 연결된 컬러 옵션 영역을 각각 찾습니다.
   */
  function findOptionGroups() {
    var groups = [];

    $('.form-select-wrap').each(function () {
      var $sizeWrap = $(this);

      if (!isSizeWrap($sizeWrap)) {
        return;
      }

      if (isHiddenWrap($sizeWrap)) {
        return;
      }

      var $row = $sizeWrap.closest('.row');

      if (!$row.length) {
        return;
      }

      var $colorWrap = $();

      /*
       * 같은 row 안에서 현재 선택된 컬러 영역을 우선 찾습니다.
       */
      $row.find('.form-select-wrap').each(function () {
        var $candidate = $(this);

        if (!isColorWrap($candidate)) {
          return;
        }

        if (isHiddenWrap($candidate)) {
          return;
        }

        if (hasSelectedColorText($candidate)) {
          $colorWrap = $candidate;
          return false;
        }

        if (!$colorWrap.length) {
          $colorWrap = $candidate;
        }
      });

      /*
       * 같은 row에서 못 찾으면 같은 goods_select 안에서 찾습니다.
       */
      if (!$colorWrap.length) {
        var $goodsSelect = $sizeWrap.closest('.goods_select');

        $goodsSelect
          .find('.form-select-wrap')
          .each(function () {
            var $candidate = $(this);

            if (!isColorWrap($candidate)) {
              return;
            }

            if (isHiddenWrap($candidate)) {
              return;
            }

            if (hasSelectedColorText($candidate)) {
              $colorWrap = $candidate;
              return false;
            }

            if (!$colorWrap.length) {
              $colorWrap = $candidate;
            }
          });
      }

      /*
       * 가장 가까운 이전 옵션 영역에서도 한 번 더 찾습니다.
       */
      if (!$colorWrap.length) {
        $sizeWrap
          .closest('.col-xs-12, .col-md-12, ._form_parent')
          .prevAll()
          .each(function () {
            var $candidate = $(this)
              .find('.form-select-wrap')
              .filter(function () {
                return isColorWrap($(this));
              })
              .first();

            if (
              $candidate.length &&
              !isHiddenWrap($candidate)
            ) {
              $colorWrap = $candidate;
              return false;
            }
          });
      }

      if (!$colorWrap.length) {
        return;
      }

      groups.push({
        $row: $row,
        $colorWrap: $colorWrap,
        $sizeWrap: $sizeWrap
      });
    });

    return groups;
  }

  /*
   * 선택된 컬러의 옵션 데이터를 가져옵니다.
   */
  function getSelectedColorOption($colorWrap) {
    if (!$colorWrap || !$colorWrap.length) {
      return null;
    }

    /*
     * selected 클래스가 있는 항목을 우선 사용합니다.
     */
    var $selectedTarget = $colorWrap
      .find('.dropdown-item.selected')
      .first()
      .find('[onclick*="selectRequireOption"]')
      .first();

    var selectedData = parseOptionData($selectedTarget);

    if (selectedData) {
      return selectedData;
    }

    /*
     * 드롭다운 상단에 표시된 선택 컬러명을 사용합니다.
     */
    var selectedName = normalizeText(
      $colorWrap.find('.dropdown-toggle').first().text()
    );

    if (
      !selectedName ||
      selectedName.indexOf('필수') !== -1 ||
      selectedName === '컬러' ||
      selectedName === '색상'
    ) {
      return null;
    }

    $colorWrap
      .find('.dropdown-item')
      .each(function () {
        var $target = $(this)
          .find('[onclick*="selectRequireOption"]')
          .first();

        var optionData = parseOptionData($target);

        if (
          optionData &&
          normalizeText(optionData.valueName) === selectedName
        ) {
          selectedData = optionData;
          return false;
        }
      });

    return selectedData || null;
  }

  /*
   * 재고번호가 예약배송용 문구인지 확인합니다.
   */
  function isReservedShippingSku(skuNo) {
    skuNo = normalizeText(skuNo);

    if (!skuNo) {
      return false;
    }

    return CONFIG.skuKeywords.some(function (keyword) {
      return skuNo.indexOf(keyword) !== -1;
    });
  }

  /*
   * 기존 예약배송 문구를 제거합니다.
   */
  function removeMessageFromItem($item) {
    if (!$item || !$item.length) {
      return;
    }

    $item.find('.reserved-shipping-text').remove();

    $item
      .removeClass('has-reserved-shipping')
      .removeAttr('data-reserved-loaded');

    $item
      .find('.reserved-option-content')
      .removeClass('reserved-option-content');
  }

  /*
   * 옵션 바로 아래에 예약배송 문구를 삽입합니다.
   */
  function appendReservedMessage($item, skuNo) {
    removeMessageFromItem($item);

    skuNo = normalizeText(skuNo);

    if (!isReservedShippingSku(skuNo)) {
      $item.attr('data-reserved-loaded', 'true');
      return;
    }

    var $sizeName = $item
      .find('span.margin-bottom-lg')
      .first();

    /*
     * margin-bottom-lg 클래스가 없는 구조 대응
     */
    if (!$sizeName.length) {
      $sizeName = $item
        .find('span.blocked')
        .filter(function () {
          var text = normalizeText($(this).text());

          return (
            text &&
            text.indexOf('남음') === -1 &&
            text.indexOf('품절') === -1 &&
            text.indexOf('순차 발송') === -1 &&
            text.indexOf('예약배송') === -1
          );
        })
        .first();
    }

    if (!$sizeName.length) {
      return;
    }

    var $contentWrap = $sizeName.parent();

    if (!$contentWrap.length) {
      return;
    }

    $contentWrap.addClass('reserved-option-content');

    var $message = $('<span>', {
      class: 'reserved-shipping-text'
    });

    $('<span>', {
      class: 'reserved-shipping-date',
      text: skuNo
    }).appendTo($message);

    $('<span>', {
      class: 'reserved-shipping-badge',
      text: CONFIG.badgeText
    }).appendTo($message);

    $contentWrap.append($message);

    $item
      .addClass('has-reserved-shipping')
      .attr('data-reserved-loaded', 'true');
  }

  /*
   * select_option.cm 요청 데이터를 생성합니다.
   */
  function buildRequestData(colorOption, sizeOption) {
    return {
      prod_idx: sizeOption.prodIdx || colorOption.prodIdx,

      'options[0][value_type]': 'SELECT',
      'options[0][option_code]': colorOption.optionCode,
      'options[0][value_code]': colorOption.valueCode,
      'options[0][value_name]': colorOption.valueName,

      'options[1][value_type]': 'SELECT',
      'options[1][option_code]': sizeOption.optionCode,
      'options[1][value_code]': sizeOption.valueCode,
      'options[1][value_name]': sizeOption.valueName,

      require: 'Y',
      count: 1,
      idx: 0,
      skip_quantity_validation: false
    };
  }

  /*
   * 컬러 + 사이즈 조합의 SKU를 조회합니다.
   */
  function requestSku(colorOption, sizeOption) {
    var cacheKey = [
      sizeOption.prodIdx || colorOption.prodIdx,
      colorOption.valueCode,
      sizeOption.valueCode
    ].join('|');

    if (
      Object.prototype.hasOwnProperty.call(
        skuCache,
        cacheKey
      )
    ) {
      return $.Deferred()
        .resolve(skuCache[cacheKey])
        .promise();
    }

    if (pendingRequests[cacheKey]) {
      return pendingRequests[cacheKey];
    }

    var deferred = $.Deferred();

    pendingRequests[cacheKey] = deferred.promise();

    $.ajax({
      url: '/shop/select_option.cm',
      type: 'POST',
      dataType: 'json',
      data: buildRequestData(
        colorOption,
        sizeOption
      )
    })
      .done(function (response) {
        var skuNo = '';

        if (
          response &&
          response.msg === 'SUCCESS' &&
          response.selected_option
        ) {
          skuNo = normalizeText(
            response.selected_option.sku_no
          );
        }

        skuCache[cacheKey] = skuNo;
        deferred.resolve(skuNo);
      })
      .fail(function () {
        deferred.resolve('');
      })
      .always(function () {
        delete pendingRequests[cacheKey];
      });

    return deferred.promise();
  }

  /*
   * 옵션 코드가 일치하는 현재 DOM 행을 다시 찾습니다.
   * 아임웹이 옵션 HTML을 교체한 경우를 대응합니다.
   */
  function findCurrentSizeItem(
    $sizeWrap,
    sizeValueCode
  ) {
    var $result = $();

    $sizeWrap
      .find('.dropdown-item')
      .each(function () {
        var $candidate = $(this);

        var $target = $candidate
          .find('[onclick*="selectRequireOption"]')
          .first();

        var optionData = parseOptionData($target);

        if (
          optionData &&
          optionData.valueCode === sizeValueCode
        ) {
          $result = $candidate;
          return false;
        }
      });

    return $result;
  }

  /*
   * 개별 PC 또는 모바일 옵션 영역을 처리합니다.
   */
  function renderGroup(group) {
    var colorOption = getSelectedColorOption(
      group.$colorWrap
    );

    if (!colorOption) {
      return;
    }

    var jobs = [];

    group.$sizeWrap
      .find('.dropdown-item')
      .each(function () {
        var $item = $(this);

        var $clickTarget = $item
          .find('[onclick*="selectRequireOption"]')
          .first();

        var sizeOption = parseOptionData(
          $clickTarget
        );

        if (!sizeOption) {
          return;
        }

        if (
          String(sizeOption.prodIdx) !==
          String(colorOption.prodIdx)
        ) {
          return;
        }

        var reservedKey = [
          colorOption.valueCode,
          sizeOption.valueCode
        ].join('|');

        if (
          $item.attr('data-reserved-key') ===
            reservedKey &&
          $item.attr('data-reserved-loaded') ===
            'true'
        ) {
          return;
        }

        removeMessageFromItem($item);

        $item.attr(
          'data-reserved-key',
          reservedKey
        );

        jobs.push({
          $item: $item,
          sizeOption: sizeOption,
          reservedKey: reservedKey
        });
      });

    jobs.forEach(function (job, index) {
      window.setTimeout(function () {
        /*
         * 요청 중 컬러가 변경됐는지 확인합니다.
         */
        var latestColor = getSelectedColorOption(
          group.$colorWrap
        );

        if (
          !latestColor ||
          latestColor.valueCode !==
            colorOption.valueCode
        ) {
          return;
        }

        requestSku(
          colorOption,
          job.sizeOption
        ).done(function (skuNo) {
          var $currentItem =
            findCurrentSizeItem(
              group.$sizeWrap,
              job.sizeOption.valueCode
            );

          if (!$currentItem.length) {
            return;
          }

          var currentKey = [
            colorOption.valueCode,
            job.sizeOption.valueCode
          ].join('|');

          $currentItem.attr(
            'data-reserved-key',
            currentKey
          );

          appendReservedMessage(
            $currentItem,
            skuNo
          );
        });
      }, index * CONFIG.requestInterval);
    });
  }

  /*
   * PC와 모바일 옵션 영역을 모두 처리합니다.
   */
  function renderReservedShipping() {
    var groups = findOptionGroups();

    groups.forEach(function (group) {
      renderGroup(group);
    });
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);

    renderTimer = window.setTimeout(function () {
      renderReservedShipping();
    }, CONFIG.renderDelay);
  }

  /*
   * 컬러 및 사이즈 옵션 클릭 감지
   */
  $(document).on(
    'click',
    '.goods_select .dropdown-item, ' +
    '.goods_select .dropdown-toggle, ' +
    '.form-select-wrap .dropdown-item, ' +
    '.form-select-wrap .dropdown-toggle',
    function () {
      scheduleRender();

      window.setTimeout(
        scheduleRender,
        300
      );

      window.setTimeout(
        scheduleRender,
        700
      );

      window.setTimeout(
        scheduleRender,
        1200
      );
    }
  );

  /*
   * 아임웹 옵션 HTML 변경 완료 감지
   */
  $(document).ajaxComplete(function (
    event,
    xhr,
    settings
  ) {
    if (!settings || !settings.url) {
      return;
    }

    if (
      settings.url.indexOf(
        'load_option.cm'
      ) !== -1
    ) {
      scheduleRender();

      window.setTimeout(
        scheduleRender,
        300
      );
    }
  });

  /*
   * 모바일 옵션 팝업 및 PC 옵션 DOM 재생성 감지
   */
  var observer = new MutationObserver(
    function (mutations) {
      var shouldRender = false;

      mutations.forEach(function (mutation) {
        if (mutation.type !== 'childList') {
          return;
        }

        Array.prototype.forEach.call(
          mutation.addedNodes || [],
          function (node) {
            if (
              !node ||
              node.nodeType !== 1
            ) {
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
                '.goods_select, ' +
                '.row, ' +
                '.dropdown-menu, ' +
                '.dropdown-item, ' +
                '.form-select-wrap'
              ) ||
              $(node).find(
                '.goods_select, ' +
                '.dropdown-menu, ' +
                '.dropdown-item, ' +
                '.form-select-wrap'
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
    }
  );

  function initialize() {
    if (!document.body) {
      return;
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleRender();

    window.setTimeout(
      scheduleRender,
      500
    );

    window.setTimeout(
      scheduleRender,
      1200
    );

    window.setTimeout(
      scheduleRender,
      2000
    );
  }

  $(initialize);

})(jQuery);
