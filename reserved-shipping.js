(function bootReservedShipping() {
  'use strict';

  if (!window.jQuery) {
    window.setTimeout(bootReservedShipping, 100);
    return;
  }

  (function ($) {
    'use strict';

    var skuCache = {};
    var requestCache = {};
    var renderTimer = null;

    function clean(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /*
     * 아임웹 onclick 속성에서 옵션 정보 추출
     */
    function parseOption(element) {
      if (!element) {
        return null;
      }

      var onclick =
        element.getAttribute('onclick') || '';

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
     * 실제 상품 필수옵션 영역 찾기
     * 추가상품 옵션은 제외
     */
    function getOptionContainers() {
      var containers = [];

      document
        .querySelectorAll('.goods_select')
        .forEach(function (container) {
          if (
            container.classList.contains(
              'goods-select-prod-additional'
            ) ||
            container.id === 'prod_additional' ||
            container.id ===
              'prod_additional_options'
          ) {
            return;
          }

          if (
            !container.querySelector(
              '.dropdown-item ' +
              '[onclick*="selectRequireOption"]'
            )
          ) {
            return;
          }

          if (
            containers.indexOf(container) === -1
          ) {
            containers.push(container);
          }
        });

      return containers;
    }

    /*
     * 현재 선택된 컬러 정보 확인
     */
    function getSelectedColor(container) {
      var result = null;

      container
        .querySelectorAll('.form-select-wrap')
        .forEach(function (wrap) {
          if (result) {
            return;
          }

          var toggle =
            wrap.querySelector(
              ':scope > .dropdown-toggle'
            ) ||
            wrap.querySelector(
              '.dropdown-toggle'
            );

          if (!toggle) {
            return;
          }

          var selectedName = clean(
            toggle.textContent
          );

          var toggleOptionCode =
            toggle.getAttribute(
              'data-option-code'
            ) || '';

          /*
           * 미선택 문구 및 사이즈 옵션 제외
           */
          if (
            !selectedName ||
            selectedName.indexOf('필수') !== -1 ||
            selectedName.indexOf('사이즈') !== -1 ||
            selectedName === '컬러' ||
            selectedName === '색상'
          ) {
            return;
          }

          wrap.querySelectorAll(
            '.dropdown-item ' +
            '[onclick*="selectRequireOption"]'
          ).forEach(function (element) {
            if (result) {
              return;
            }

            var data = parseOption(element);

            if (
              data &&
              clean(data.valueName) ===
                selectedName &&
              (
                !toggleOptionCode ||
                data.optionCode ===
                  toggleOptionCode
              )
            ) {
              result = data;
            }
          });
        });

      /*
       * selected 클래스 보조 확인
       */
      if (!result) {
        container.querySelectorAll(
          '.dropdown-item.selected ' +
          '[onclick*="selectRequireOption"]'
        ).forEach(function (element) {
          if (!result) {
            result = parseOption(element);
          }
        });
      }

      return result;
    }

    /*
     * 컬러 옵션과 다른 옵션코드의 행을
     * 사이즈 옵션으로 처리
     */
    function getSizeEntries(
      container,
      color
    ) {
      var entries = [];

      container.querySelectorAll(
        '.dropdown-item ' +
        '[onclick*="selectRequireOption"]'
      ).forEach(function (element) {
        var data = parseOption(element);

        if (!data) {
          return;
        }

        if (
          String(data.prodIdx) !==
            String(color.prodIdx) ||
          data.optionCode === color.optionCode
        ) {
          return;
        }

        var item =
          element.closest('.dropdown-item');

        if (!item) {
          return;
        }

        entries.push({
          item: item,
          data: data
        });
      });

      return entries;
    }

    function getCacheKey(color, size) {
      return [
        size.prodIdx,
        color.valueCode,
        size.valueCode
      ].join('|');
    }

    /*
     * select_option.cm 요청값 생성
     */
    function buildPayload(color, size) {
      return {
        prod_idx: size.prodIdx,

        'options[0][value_type]': 'SELECT',
        'options[0][option_code]':
          color.optionCode,
        'options[0][value_code]':
          color.valueCode,
        'options[0][value_name]':
          color.valueName,

        'options[1][value_type]': 'SELECT',
        'options[1][option_code]':
          size.optionCode,
        'options[1][value_code]':
          size.valueCode,
        'options[1][value_name]':
          size.valueName,

        require: 'Y',
        count: 1,
        idx: 0,
        skip_quantity_validation: false
      };
    }

    /*
     * 컬러 + 사이즈 조합별 SKU 조회
     */
    function requestSku(color, size) {
      var cacheKey =
        getCacheKey(color, size);

      if (
        Object.prototype.hasOwnProperty.call(
          skuCache,
          cacheKey
        )
      ) {
        return Promise.resolve(
          skuCache[cacheKey]
        );
      }

      if (requestCache[cacheKey]) {
        return requestCache[cacheKey];
      }

      requestCache[cacheKey] =
        new Promise(function (resolve) {
          $.ajax({
            url: '/shop/select_option.cm',
            type: 'POST',
            dataType: 'json',
            cache: false,
            data: buildPayload(color, size)
          })
            .done(function (response) {
              var skuNo = '';

              if (
                response &&
                response.msg === 'SUCCESS' &&
                response.selected_option
              ) {
                skuNo = clean(
                  response
                    .selected_option
                    .sku_no
                );
              }

              /*
               * 빈값도 캐시하여
               * 불필요한 재요청 방지
               */
              skuCache[cacheKey] = skuNo;

              resolve(skuNo);
            })
            .fail(function () {
              skuCache[cacheKey] = '';
              resolve('');
            })
            .always(function () {
              delete requestCache[cacheKey];
            });
        });

      return requestCache[cacheKey];
    }

    /*
     * 출력 여부 확인
     *
     * 제외:
     * A729348660751
     * 730936359717
     * ABCDE
     *
     * 출력:
     * 8/14 이후 순차 출고
     * 08.10(월) 이후 순차 발송
     * 입고 후 순차 배송 예정
     */
    function shouldDisplaySku(skuNo) {
      skuNo = clean(skuNo);

      if (!skuNo) {
        return false;
      }

      /*
       * 영문과 숫자로만 이루어진 값 제외
       * 숫자로만 이루어진 값도 함께 제외됨
       */
      if (/^[A-Za-z0-9]+$/.test(skuNo)) {
        return false;
      }

      return true;
    }

    function removeMessage(item) {
      item.querySelectorAll(
        '.reserved-shipping-text'
      ).forEach(function (node) {
        node.remove();
      });

      item.classList.remove(
        'has-reserved-shipping'
      );

      item.querySelectorAll(
        '.reserved-option-content'
      ).forEach(function (node) {
        node.classList.remove(
          'reserved-option-content'
        );
      });
    }

    /*
     * 옵션 행에 문구 삽입
     */
    function insertMessage(
      item,
      skuNo,
      key
    ) {
      skuNo = clean(skuNo);

      removeMessage(item);

      item.setAttribute(
        'data-reserved-key',
        key
      );

      item.setAttribute(
        'data-reserved-loaded',
        'true'
      );

      if (!shouldDisplaySku(skuNo)) {
        return;
      }

      var sizeName =
        item.querySelector(
          '.tw-flex-row .margin-bottom-lg'
        ) ||
        item.querySelector(
          '.margin-bottom-lg'
        ) ||
        item.querySelector(
          '.tw-flex-row span.blocked'
        );

      if (!sizeName) {
        return;
      }

      var content =
        sizeName.parentElement;

      if (!content) {
        return;
      }

      content.classList.add(
        'reserved-option-content'
      );

      var message =
        document.createElement('span');

      message.className =
        'reserved-shipping-text';

      var date =
        document.createElement('span');

      date.className =
        'reserved-shipping-date';

      date.textContent = skuNo;

      var badge =
        document.createElement('span');

      badge.className =
        'reserved-shipping-badge';

      badge.textContent = '예약배송';

      message.appendChild(date);
      message.appendChild(badge);
      content.appendChild(message);

      item.classList.add(
        'has-reserved-shipping'
      );
    }

    /*
     * AJAX 도중 옵션 HTML이 바뀌었을 경우
     * 현재 DOM에서 동일 옵션 행 다시 찾기
     */
    function findCurrentItem(
      container,
      sizeData
    ) {
      var currentItem = null;

      container.querySelectorAll(
        '.dropdown-item ' +
        '[onclick*="selectRequireOption"]'
      ).forEach(function (element) {
        if (currentItem) {
          return;
        }

        var data = parseOption(element);

        if (
          data &&
          String(data.prodIdx) ===
            String(sizeData.prodIdx) &&
          data.optionCode ===
            sizeData.optionCode &&
          data.valueCode ===
            sizeData.valueCode
        ) {
          currentItem =
            element.closest(
              '.dropdown-item'
            );
        }
      });

      return currentItem;
    }

    /*
     * 개별 옵션 영역 처리
     *
     * 모든 사이즈를 동시에 요청하므로
     * 기존 순차 방식보다 빠르게 표시됨
     */
    function renderContainer(container) {
      var color =
        getSelectedColor(container);

      if (!color) {
        return Promise.resolve();
      }

      var entries =
        getSizeEntries(container, color);

      var jobs = entries.map(
        function (entry) {
          var key = [
            color.valueCode,
            entry.data.valueCode
          ].join('|');

          var oldKey =
            entry.item.getAttribute(
              'data-reserved-key'
            );

          /*
           * 컬러 변경 시 이전 문구 제거
           */
          if (oldKey && oldKey !== key) {
            removeMessage(entry.item);

            entry.item.removeAttribute(
              'data-reserved-loaded'
            );
          }

          entry.item.setAttribute(
            'data-reserved-key',
            key
          );

          /*
           * 이미 처리된 행은 건너뜀
           */
          if (
            entry.item.getAttribute(
              'data-reserved-loaded'
            ) === 'true'
          ) {
            return Promise.resolve();
          }

          return requestSku(
            color,
            entry.data
          ).then(function (skuNo) {
            var currentItem =
              findCurrentItem(
                container,
                entry.data
              );

            if (!currentItem) {
              return;
            }

            /*
             * 요청 도중 컬러가 변경됐는지 확인
             */
            var latestColor =
              getSelectedColor(container);

            if (
              !latestColor ||
              latestColor.valueCode !==
                color.valueCode
            ) {
              return;
            }

            insertMessage(
              currentItem,
              skuNo,
              key
            );
          });
        }
      );

      return Promise.all(jobs);
    }

    /*
     * PC와 모바일 옵션 영역 모두 처리
     */
    function renderAll() {
      var containers =
        getOptionContainers();

      containers.forEach(function (
        container
      ) {
        renderContainer(container);
      });
    }

    function scheduleRender(delay) {
      window.clearTimeout(renderTimer);

      renderTimer = window.setTimeout(
        renderAll,
        typeof delay === 'number'
          ? delay
          : 50
      );
    }

    /*
     * 기존 예약배송 클릭 이벤트 제거 후 등록
     */
    $(document)
      .off('.reservedShipping')
      .on(
        'click.reservedShipping',
        '.form-select-wrap ' +
        '.dropdown-item, ' +
        '.form-select-wrap ' +
        '.dropdown-toggle',
        function () {
          scheduleRender(30);
          window.setTimeout(
            renderAll,
            150
          );
          window.setTimeout(
            renderAll,
            350
          );
        }
      );

    /*
     * 컬러 선택 후 옵션 목록 갱신 감지
     */
    $(document).ajaxComplete(
      function (
        event,
        xhr,
        settings
      ) {
        if (
          settings &&
          settings.url &&
          settings.url.indexOf(
            'load_option.cm'
          ) !== -1
        ) {
          scheduleRender(20);

          window.setTimeout(
            renderAll,
            120
          );
        }
      }
    );

    /*
     * PC·모바일 옵션 DOM 재생성 감지
     */
    var observer =
      new MutationObserver(
        function (mutations) {
          var shouldRender = false;

          mutations.forEach(
            function (mutation) {
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
                    node.classList &&
                    node.classList.contains(
                      'reserved-shipping-text'
                    )
                  ) {
                    return;
                  }

                  if (
                    node.matches &&
                    node.matches(
                      '.goods_select, ' +
                      '.form-select-wrap, ' +
                      '.dropdown-menu, ' +
                      '.dropdown-item'
                    )
                  ) {
                    shouldRender = true;
                    return;
                  }

                  if (
                    node.querySelector &&
                    node.querySelector(
                      '.goods_select, ' +
                      '.form-select-wrap, ' +
                      '.dropdown-menu, ' +
                      '.dropdown-item'
                    )
                  ) {
                    shouldRender = true;
                  }
                }
              );
            }
          );

          if (shouldRender) {
            scheduleRender(30);
          }
        }
      );

    /*
     * 초기 실행
     */
    $(function () {
      if (document.body) {
        observer.observe(
          document.body,
          {
            childList: true,
            subtree: true
          }
        );
      }

      scheduleRender(20);

      window.setTimeout(
        renderAll,
        300
      );
    });

  })(window.jQuery);
})();
