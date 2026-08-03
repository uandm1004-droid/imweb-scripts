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
   * 아임웹 onclick 정보 추출
   */
  function parseOption(element) {
    if (!element) return null;

    var onclick = element.getAttribute('onclick') || '';

    var match = onclick.match(
      /selectRequireOption\s*\(\s*['"]prod['"]\s*,\s*(\d+)\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/
    );

    if (!match) return null;

    return {
      prodIdx: match[1],
      optionCode: match[2],
      valueCode: match[3],
      valueName: match[4]
    };
  }

  /*
   * 페이지에 존재하는 모든 옵션 행 수집
   */
  function collectOptionItems() {
    var results = [];

    document
      .querySelectorAll(
        '.dropdown-item [onclick*="selectRequireOption"]'
      )
      .forEach(function (element) {
        var data = parseOption(element);

        if (!data) return;

        var item = element.closest('.dropdown-item');

        if (!item) return;

        results.push({
          item: item,
          element: element,
          data: data
        });
      });

    return results;
  }

  /*
   * 선택된 첫 번째 옵션값을 찾음
   * 이 상품에서는 첫 번째 옵션이 컬러
   */
  function findSelectedColor(items) {
    var selected = null;

    /*
     * selected 클래스 우선
     */
    items.some(function (entry) {
      if (!entry.item.classList.contains('selected')) {
        return false;
      }

      selected = entry.data;
      return true;
    });

    if (selected) {
      return selected;
    }

    /*
     * 드롭다운 버튼에 표시된 현재 선택값과 비교
     */
    var wraps = document.querySelectorAll(
      '.form-select-wrap'
    );

    Array.prototype.some.call(
      wraps,
      function (wrap) {
        var toggle = wrap.querySelector(
          ':scope > .dropdown-toggle'
        );

        if (!toggle) return false;

        var toggleText = clean(toggle.textContent);

        if (
          !toggleText ||
          toggleText.indexOf('필수') !== -1 ||
          toggleText === '사이즈'
        ) {
          return false;
        }

        var matchingItem = Array.prototype.find.call(
          wrap.querySelectorAll(
            '.dropdown-item [onclick*="selectRequireOption"]'
          ),
          function (element) {
            var data = parseOption(element);

            return (
              data &&
              clean(data.valueName) === toggleText
            );
          }
        );

        if (!matchingItem) {
          return false;
        }

        selected = parseOption(matchingItem);
        return true;
      }
    );

    return selected;
  }

  /*
   * 컬러 옵션 코드와 다른 옵션 코드의 행만 수집
   * 즉, 사이즈 행
   */
  function findSizeItems(items, color) {
    return items.filter(function (entry) {
      return (
        entry.data.prodIdx === color.prodIdx &&
        entry.data.optionCode !== color.optionCode
      );
    });
  }

  function buildPayload(color, size) {
    return {
      prod_idx: size.prodIdx,

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

  function loadSku(color, size) {
    var key = [
      size.prodIdx,
      color.valueCode,
      size.valueCode
    ].join('|');

    if (
      Object.prototype.hasOwnProperty.call(
        skuCache,
        key
      )
    ) {
      return Promise.resolve(skuCache[key]);
    }

    if (requestCache[key]) {
      return requestCache[key];
    }

    requestCache[key] = new Promise(function (
      resolve
    ) {
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
            skuNo = clean(
              response.selected_option.sku_no
            );
          }

          skuCache[key] = skuNo;
          resolve(skuNo);
        })
        .fail(function () {
          resolve('');
        })
        .always(function () {
          delete requestCache[key];
        });
    });

    return requestCache[key];
  }

  function isReservedShipping(skuNo) {
    return (
      skuNo.indexOf('발송') !== -1 ||
      skuNo.indexOf('배송') !== -1 ||
      skuNo.indexOf('예약') !== -1
    );
  }

  /*
   * PC·모바일 옵션 행 내부에 문구 삽입
   */
  function insertMessage(
    item,
    skuNo,
    reservedKey
  ) {
    item
      .querySelectorAll('.reserved-shipping-text')
      .forEach(function (node) {
        node.remove();
      });

    item.classList.remove(
      'has-reserved-shipping'
    );

    item.setAttribute(
      'data-reserved-key',
      reservedKey
    );

    if (!isReservedShipping(skuNo)) {
      item.setAttribute(
        'data-reserved-loaded',
        'true'
      );

      return;
    }

    /*
     * PC·모바일 공통으로 실제 사이즈명이 들어 있는 span
     */
    var sizeName =
      item.querySelector(
        '.tw-flex-row span.margin-bottom-lg'
      ) ||
      item.querySelector(
        'span.margin-bottom-lg'
      );

    if (!sizeName) {
      return;
    }

    /*
     * 모바일 구조에서 사이즈명과 빈 strong을 감싸는 내부 div
     */
    var content = sizeName.parentElement;

    if (!content) {
      return;
    }

    content.classList.add(
      'reserved-option-content'
    );

    var message = document.createElement(
      'span'
    );

    message.className =
      'reserved-shipping-text';

    var date = document.createElement('span');

    date.className =
      'reserved-shipping-date';

    date.textContent = skuNo;

    var badge = document.createElement('span');

    badge.className =
      'reserved-shipping-badge';

    badge.textContent = '예약배송';

    message.appendChild(date);
    message.appendChild(badge);
    content.appendChild(message);

    item.classList.add(
      'has-reserved-shipping'
    );

    item.setAttribute(
      'data-reserved-loaded',
      'true'
    );
  }

  function render() {
    var items = collectOptionItems();
    var color = findSelectedColor(items);

    if (!color) return;

    var sizeItems = findSizeItems(
      items,
      color
    );

    sizeItems.forEach(function (entry) {
      var key = [
        color.valueCode,
        entry.data.valueCode
      ].join('|');

      if (
        entry.item.getAttribute(
          'data-reserved-key'
        ) === key &&
        entry.item.getAttribute(
          'data-reserved-loaded'
        ) === 'true'
      ) {
        return;
      }

      entry.item.setAttribute(
        'data-reserved-key',
        key
      );

      loadSku(color, entry.data).then(
        function (skuNo) {
          /*
           * AJAX 도중 모바일 옵션 DOM이 교체됐을 수 있으므로
           * 현재 DOM에서 같은 옵션 코드를 가진 행을 모두 다시 찾음
           */
          collectOptionItems().forEach(
            function (current) {
              if (
                current.data.prodIdx ===
                  entry.data.prodIdx &&
                current.data.optionCode ===
                  entry.data.optionCode &&
                current.data.valueCode ===
                  entry.data.valueCode
              ) {
                insertMessage(
                  current.item,
                  skuNo,
                  key
                );
              }
            }
          );
        }
      );
    });
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);

    renderTimer = window.setTimeout(
      render,
      150
    );
  }

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
    if (!settings || !settings.url) {
      return;
    }

    if (
      settings.url.indexOf(
        'load_option.cm'
      ) !== -1
    ) {
      scheduleRender();
      setTimeout(scheduleRender, 300);
    }
  });

  var observer = new MutationObserver(
    function (mutations) {
      var needsRender = mutations.some(
        function (mutation) {
          return Array.prototype.some.call(
            mutation.addedNodes || [],
            function (node) {
              if (
                !node ||
                node.nodeType !== 1
              ) {
                return false;
              }

              if (
                node.classList.contains(
                  'reserved-shipping-text'
                )
              ) {
                return false;
              }

              return (
                node.matches(
                  '.dropdown-item, .dropdown-menu, .form-select-wrap'
                ) ||
                node.querySelector(
                  '.dropdown-item, .dropdown-menu, .form-select-wrap'
                )
              );
            }
          );
        }
      );

      if (needsRender) {
        scheduleRender();
      }
    }
  );

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
