(function ($) {
  'use strict';

  var CONFIG = {
    badgeText: '예약배송',
    skuKeywords: ['발송', '배송', '예약'],
    requestInterval: 80,
    renderDelay: 120
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
   * 아임웹 onclick 데이터 분석
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
   * 옵션 영역 제목 확인
   */
  function getOptionTitle($wrap) {
    var $column = $wrap.closest(
      '.col-xs-12, .col-md-12, ._form_parent'
    );

    var $title = $column.find('.option_title').first().clone();

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
   * PC·모바일 각각의 옵션 세트를 찾습니다.
   */
  function findOptionGroups() {
    var groups = [];

    $('.goods_select').each(function () {
      var $goodsSelect = $(this);

      $goodsSelect.find('.row').each(function () {
        var $row = $(this);
        var $colorWrap = $();
        var $sizeWrap = $();

        $row.find('.form-select-wrap').each(function () {
          var $wrap = $(this);

          if (!$colorWrap.length && isColorWrap($wrap)) {
            $colorWrap = $wrap;
          }

          if (!$sizeWrap.length && isSizeWrap($wrap)) {
            $sizeWrap = $wrap;
          }
        });

        if ($colorWrap.length && $sizeWrap.length) {
          groups.push({
            $goodsSelect: $goodsSelect,
            $row: $row,
            $colorWrap: $colorWrap,
            $sizeWrap: $sizeWrap
          });
        }
      });
    });

    return groups;
  }

  /*
   * 해당 옵션 세트에서 선택된 컬러 확인
   */
  function getSelectedColorOption($colorWrap) {
    var selectedData = null;

    var $selectedTarget = $colorWrap
      .find('.dropdown-item.selected')
      .first()
      .find('[onclick*="selectRequireOption"]')
      .first();

    selectedData = parseOptionData($selectedTarget);

    if (selectedData) {
      return selectedData;
    }

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

    $colorWrap.find('.dropdown-item').each(function () {
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

    return selectedData;
  }

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
   * 기존 문구 제거
   */
  function removeMessageFromItem($item) {
    $item.find('.reserved-shipping-text').remove();

    $item
      .removeClass('has-reserved-shipping')
      .removeAttr('data-reserved-loaded');

    $item.find('.reserved-option-content')
      .removeClass('reserved-option-content');
  }

  /*
   * PC·모바일 공통으로 문구 삽입
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

    if (!$sizeName.length) {
      $sizeName = $item
        .find('span.blocked')
        .filter(function () {
          var text = normalizeText($(this).text());

          return (
            text &&
            text.indexOf('남음') === -1 &&
            text.indexOf('품절') === -1 &&
            text.indexOf('순차 발송') === -1
          );
        })
        .first();
    }

    if (!$sizeName.length) {
      return;
    }

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

    /*
     * PC와 모바일 모두 사이즈명이 들어 있는 내부 div에 삽입
     *
     * 결과:
     * <div class="reserved-option-content">
     *   <span>2XL</span>
     *   <span></span>
     *   <span class="reserved-shipping-text">...</span>
     * </div>
     */
    var $contentWrap = $sizeName.parent();

    if (!$contentWrap.length) {
      return;
    }

    $contentWrap.addClass('reserved-option-content');
    $contentWrap.append($message);

    $item
      .addClass('has-reserved-shipping')
      .attr('data-reserved-loaded', 'true');
  }

  /*
   * SKU 조회 요청값 생성
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
   * 컬러 + 사이즈별 SKU 조회
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
      data: buildRequestData(colorOption, sizeOption)
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
   * 개별 PC 또는 모바일 옵션 세트 처리
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

        var sizeOption = parseOptionData($clickTarget);

        if (!sizeOption) {
          return;
        }

        /*
         * 컬러와 사이즈가 같은 상품 조합인지 확인
         */
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
          $item.attr('data-reserved-key') === reservedKey &&
          $item.attr('data-reserved-loaded') === 'true'
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
          reservedKey: reservedKey,
          group: group
        });
      });

    jobs.forEach(function (job, index) {
      window.setTimeout(function () {
        var latestColor = getSelectedColorOption(
          job.group.$colorWrap
        );

        if (
          !latestColor ||
          latestColor.valueCode !== colorOption.valueCode
        ) {
          return;
        }

        requestSku(colorOption, job.sizeOption)
          .done(function (skuNo) {
            /*
             * 아임웹이 옵션 HTML을 다시 만들었을 수 있으므로
             * 해당 모바일/PC 사이즈 영역 안에서 다시 찾습니다.
             */
            var $currentItem = $();

            job.group.$sizeWrap
              .find('.dropdown-item')
              .each(function () {
                var $candidate = $(this);

                var $target = $candidate
                  .find('[onclick*="selectRequireOption"]')
                  .first();

                var candidateData =
                  parseOptionData($target);

                if (
                  candidateData &&
                  candidateData.valueCode ===
                    job.sizeOption.valueCode
                ) {
                  $currentItem = $candidate;
                  return false;
                }
              });

            if (!$currentItem.length) {
              return;
            }

            $currentItem.attr(
              'data-reserved-key',
              job.reservedKey
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
   * PC와 모바일 옵션 세트를 모두 처리
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
   * 옵션 클릭 감지
   */
  $(document).on(
    'click',
    '.goods_select .dropdown-item, ' +
    '.goods_select .dropdown-toggle',
    function () {
      scheduleRender();
      window.setTimeout(scheduleRender, 300);
      window.setTimeout(scheduleRender, 700);
    }
  );

  /*
   * 아임웹 옵션 목록 갱신 감지
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
      settings.url.indexOf('load_option.cm') !== -1
    ) {
      scheduleRender();
      window.setTimeout(scheduleRender, 250);
    }
  });

  /*
   * 모바일 옵션 팝업 DOM 생성 감지
   */
  var observer = new MutationObserver(function (mutations) {
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
            node.nodeType !== 1 ||
            $(node).hasClass('reserved-shipping-text')
          ) {
            return;
          }

          if (
            $(node).is(
              '.goods_select, .row, .dropdown-menu, ' +
              '.dropdown-item, .form-select-wrap'
            ) ||
            $(node).find(
              '.goods_select, .dropdown-menu, ' +
              '.dropdown-item, .form-select-wrap'
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

  function initialize() {
    if (!document.body) {
      return;
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleRender();

    window.setTimeout(scheduleRender, 500);
    window.setTimeout(scheduleRender, 1200);
  }

  $(initialize);

})(jQuery);
