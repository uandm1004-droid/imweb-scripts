(function () {

  const API_URL = "https://script.google.com/macros/s/AKfycbzHZKXnGomjSslR3C355roaWa7VYpcOdtzuAS7j9ZpT2QyGZAdf5OoYSqo5_DZRqBg/exec";

  const COLOR_NAMES = ["color", "colour", "컬러", "색상"];
  const SIZE_NAMES  = ["size", "사이즈"];

  const currentDomain = normalizeDomain(window.location.hostname);
  const currentIdx = new URLSearchParams(window.location.search).get("idx");

  if (!currentIdx) return;

  let productSettings = [];
  let analyzeTimer = null;


  /* ========================================
     1. 구글시트 데이터 불러오기
  ======================================== */

  fetch(API_URL, {
    cache: "no-store"
  })
    .then(response => {

      if (!response.ok) {
        throw new Error("API 응답 오류: " + response.status);
      }

      return response.json();

    })
    .then(data => {

      productSettings = data.filter(item => (
        normalizeDomain(item.domain) === currentDomain &&
        String(item.productId) === String(currentIdx) &&
        item.enabled !== false
      ));

      if (!productSettings.length) return;

      startObserver();

      /* 페이지 로딩 후 즉시 1차 분석 */
      analyzeOptions();

    })
    .catch(error => {
      console.error("예약배송 데이터 불러오기 실패:", error);
    });



  /* ========================================
     2. 아임웹 옵션 변화 감지
  ======================================== */

  function startObserver() {

    const observer = new MutationObserver(function (mutations) {

      const hasRelevantChange = mutations.some(mutation => {

        if (mutation.type === "attributes") {
          return true;
        }

        const nodes = [
          ...mutation.addedNodes,
          ...mutation.removedNodes
        ];

        return nodes.some(node => {

          if (!(node instanceof Element)) {
            return true;
          }

          /*
            우리가 직접 삽입한 예약배송 문구 때문에
            Observer가 불필요하게 다시 돌지 않도록 제외
          */

          if (
            node.classList.contains("reserved-shipping-text") ||
            node.classList.contains("reserved-shipping-date") ||
            node.classList.contains("reserved-shipping-badge")
          ) {
            return false;
          }

          return true;

        });

      });


      if (hasRelevantChange) {
        scheduleAnalyze();
      }

    });


    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "checked",
        "aria-expanded"
      ]
    });



    /*
      radio / select 변경 감지
    */

    document.addEventListener("change", function (event) {

      if (!event.target.closest("#prod_options")) return;

      analyzeOptions();

      /*
        아임웹이 뒤늦게 옵션 DOM을 교체하는 경우 대응
      */

      setTimeout(analyzeOptions, 30);
      setTimeout(analyzeOptions, 100);

    }, true);



    /*
      컬러칩 / 드롭다운 클릭 감지
    */

    document.addEventListener("click", function (event) {

      if (!event.target.closest("#prod_options")) return;

      /*
        즉시 현재 DOM 분석
      */

      analyzeOptions();


      /*
        아임웹 내부 옵션 갱신 시간차 대응
      */

      setTimeout(analyzeOptions, 30);
      setTimeout(analyzeOptions, 100);

    }, true);

  }



  /* ========================================
     3. Observer 호출 정리
  ======================================== */

  function scheduleAnalyze() {

    clearTimeout(analyzeTimer);

    analyzeTimer = setTimeout(function () {
      analyzeOptions();
    }, 0);

  }



  /* ========================================
     4. 현재 보이는 상품 옵션 영역 찾기
  ======================================== */

  function getVisibleProductOptions() {

    const candidates = [
      ...document.querySelectorAll("#prod_options")
    ];


    return (
      candidates.find(isVisible) ||
      candidates[0] ||
      null
    );

  }


  function isVisible(element) {

    if (!element) return false;

    const style =
      window.getComputedStyle(element);


    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );

  }



  /* ========================================
     5. 옵션 전체 분석
  ======================================== */

  function analyzeOptions() {

    const root =
      getVisibleProductOptions();


    if (!root) return;


    const colorInfo =
      detectColor(root);


    const sizeInfo =
      detectSizes(root);



    /*
      컬러를 아직 선택하지 않은 상태
    */

    if (!colorInfo.value) {

      cleanupAllManagedNotices(root);

      return;

    }



    /*
      ========================================
      컬러 + 사이즈 상품
      ========================================
    */

    if (sizeInfo.exists) {

      const activeKeys =
        new Set();


      sizeInfo.items.forEach(item => {

        const key =
          normalizeOption(colorInfo.value)
          + "|"
          + normalizeOption(item.value);


        activeKeys.add(key);


        const matched =
          findSheetMatch(
            colorInfo.value,
            item.value
          );


        syncSizeMessage(
          item.element,
          key,
          matched ? matched.message : null
        );

      });


      cleanupStaleSizeNotices(
        root,
        activeKeys
      );


      /*
        컬러 전용 안내 제거
      */

      root.querySelectorAll(
        ".reserved-color-only"
      ).forEach(el => el.remove());


      return;

    }



    /*
      ========================================
      컬러만 있고 사이즈 없는 상품
      ========================================
    */

    cleanupSizeNotices(root);


    const key =
      normalizeOption(colorInfo.value)
      + "|";


    const matched =
      findSheetMatch(
        colorInfo.value,
        ""
      );


    syncColorOnlyMessage(
      root,
      colorInfo,
      key,
      matched ? matched.message : null
    );

  }



  /* ========================================
     6. 현재 선택 컬러 감지
  ======================================== */

  function detectColor(root) {


    /*
      ----------------------------------------
      A. 컬러칩
      ----------------------------------------
    */

    const colorLabels = [
      ...root.querySelectorAll(
        'label[data-opttype="color"]'
      )
    ];


    if (colorLabels.length) {

      const checked =
        colorLabels.find(label => {

          const input =
            label.querySelector(
              'input[type="radio"]'
            );

          return (
            input &&
            input.checked
          );

        });


      return {

        type: "chip",

        value: checked
          ? cleanText(
              checked.dataset.title
            )
          : null,

        element:
          checked || null

      };

    }



    /*
      ----------------------------------------
      B. 컬러 드롭다운
      ----------------------------------------
    */

    const groups =
      getOptionGroups(root);


    const colorGroup =
      groups.find(group =>
        isColorName(group.title)
      );


    if (colorGroup) {


      /*
        현재 선택된 dropdown-item
      */

      const selected =
        colorGroup.element.querySelector(
          ".dropdown-item.selected"
        );


      if (selected) {

        const value =
          extractDropdownItemText(
            selected
          );


        if (value) {

          return {

            type: "dropdown",

            value: value,

            element: selected

          };

        }

      }



      /*
        selected 클래스가 없는 구조 대비
        toggle 현재 표시값 사용
      */

      const toggle =
        colorGroup.element.querySelector(
          ".dropdown-toggle"
        );


      if (toggle) {

        const text =
          cleanText(
            toggle.textContent
          );


        if (
          text &&
          !isPlaceholder(
            text,
            COLOR_NAMES
          )
        ) {

          return {

            type: "dropdown",

            value: text,

            element: toggle

          };

        }

      }

    }


    return {

      type: null,

      value: null,

      element: null

    };

  }



  /* ========================================
     7. 사이즈 목록 감지
  ======================================== */

  function detectSizes(root) {

    const groups =
      getOptionGroups(root);


    const sizeGroup =
      groups.find(group =>
        isSizeName(group.title)
      );


    /*
      사이즈 그룹 자체가 없음
    */

    if (!sizeGroup) {

      return {
        exists: false,
        items: []
      };

    }


    const dropdownItems = [
      ...sizeGroup.element.querySelectorAll(
        ".dropdown-item"
      )
    ];


    const items = [];


    dropdownItems.forEach(item => {

      const value =
        extractSizeText(item);


      if (!value) return;


      /*
        컬러 선택 전 안내 문구 제외
      */

      if (
        value.includes("선택해주세요") ||
        value.includes("선택해 주세요")
      ) {
        return;
      }


      items.push({

        value: value,

        element: item

      });

    });


    return {

      exists: true,

      items: items

    };

  }



  /* ========================================
     8. 옵션 그룹 찾기
  ======================================== */

  function getOptionGroups(root) {

    const groups = [];



    /*
      ----------------------------------------
      PC형
      option_title 기준
      ----------------------------------------
    */

    root.querySelectorAll(
      ".option_title"
    )
      .forEach(titleEl => {


        const title =
          cleanOptionTitle(
            titleEl.textContent
          );


        /*
          "필수옵션" 등의 일반 제목 제외
        */

        if (
          !isColorName(title) &&
          !isSizeName(title)
        ) {
          return;
        }


        const parent =
          titleEl.closest(
            "._form_parent"
          )
          ||
          titleEl.parentElement;


        if (!parent) return;


        groups.push({

          title: title,

          element: parent

        });

      });



    /*
      ----------------------------------------
      모바일형 / option_title 없는 구조
      ----------------------------------------
    */

    root.querySelectorAll(
      "._form_parent"
    )
      .forEach(parent => {


        /*
          이미 찾은 그룹 제외
        */

        if (
          groups.some(group =>
            group.element === parent
          )
        ) {
          return;
        }


        const wrap =
          parent.querySelector(
            ".form-select-wrap"
          );


        const toggle =
          parent.querySelector(
            ".dropdown-toggle"
          );


        if (
          !wrap ||
          !toggle
        ) {
          return;
        }


        let title = "";



        /*
          모바일 컬러 드롭다운
        */

        if (
          wrap.classList.contains(
            "color"
          )
        ) {

          title = "Color";

        }


        /*
          Size
        */

        else {

          const toggleText =
            cleanText(
              toggle.textContent
            );


          if (
            isSizeName(
              toggleText
            )
          ) {

            title = "Size";

          }

        }


        if (!title) return;


        groups.push({

          title: title,

          element: parent

        });

      });


    return groups;

  }



  /* ========================================
     9. 구글시트 옵션 매칭
  ======================================== */

  function findSheetMatch(
    color,
    size
  ) {

    const normalizedColor =
      normalizeOption(color);


    const normalizedSize =
      normalizeOption(size);


    return productSettings.find(
      item => {


        const sheetColor =
          normalizeOption(
            item.color
          );


        const sheetSize =
          normalizeOption(
            item.size
          );


        const colorMatch =
          sheetColor ===
          normalizedColor;


        const sizeMatch =
          normalizedSize
            ? (
                sheetSize ===
                normalizedSize
              )
            : (
                sheetSize === "" ||
                sheetSize === "all"
              );


        return (
          colorMatch &&
          sizeMatch
        );

      }
    ) || null;

  }



  /* ========================================
     10. 사이즈 옵션 문구 동기화
  ======================================== */

  function syncSizeMessage(
    dropdownItem,
    key,
    message
  ) {

    if (!dropdownItem) return;


    const existing =
      dropdownItem.querySelector(
        ".reserved-shipping-text[data-reserved-key]"
      );



    /*
      예약배송 대상이 아닌 옵션
    */

    if (!message) {

      if (existing) {
        existing.remove();
      }


      dropdownItem.classList.remove(
        "has-reserved-shipping"
      );


      return;

    }



    /*
      이미 같은 옵션의 예약배송 문구 존재
    */

    if (
      existing &&
      existing.dataset.reservedKey === key
    ) {


      const dateEl =
        existing.querySelector(
          ".reserved-shipping-date"
        );


      /*
        시트 문구만 변경된 경우
      */

      if (
        dateEl &&
        cleanText(
          dateEl.textContent
        )
        !==
        cleanText(message)
      ) {

        dateEl.textContent =
          message;

      }


      return;

    }



    /*
      다른 key의 기존 문구 제거
    */

    if (existing) {
      existing.remove();
    }



    const link =
      dropdownItem.querySelector(
        "a._requireOption"
      );


    if (!link) return;



    /*
      아임웹 기본 flex 행
    */

    const flex =
      link.querySelector(
        ".tw-flex"
      );


    if (!flex) return;



    /*
      예약배송 문구 생성
    */

    const notice =
      document.createElement(
        "span"
      );


    notice.className =
      "reserved-shipping-text";


    notice.dataset.reservedKey =
      key;


    notice.innerHTML =
      '<span class="reserved-shipping-date">'
      + escapeHtml(message)
      + '</span>'
      + '<span class="reserved-shipping-badge">'
      + '예약배송'
      + '</span>';



    /*
      M/L/XL 영역의 형제 요소로 삽입

      결과:
      M        예약배송 문구
    */

    flex.appendChild(notice);


    dropdownItem.classList.add(
      "has-reserved-shipping"
    );

  }



  /* ========================================
     11. 사이즈 없는 상품
  ======================================== */

  function syncColorOnlyMessage(
    root,
    colorInfo,
    key,
    message
  ) {

    const existing =
      root.querySelector(
        ".reserved-color-only[data-reserved-key]"
      );



    /*
      예약배송 대상 아님
    */

    if (!message) {

      if (existing) {
        existing.remove();
      }

      return;

    }



    /*
      이미 같은 컬러 표시 중
    */

    if (
      existing &&
      existing.dataset.reservedKey === key
    ) {


      const dateEl =
        existing.querySelector(
          ".reserved-shipping-date"
        );


      if (
        dateEl &&
        cleanText(
          dateEl.textContent
        )
        !==
        cleanText(message)
      ) {

        dateEl.textContent =
          message;

      }


      return;

    }



    if (existing) {
      existing.remove();
    }



    const notice =
      document.createElement(
        "span"
      );


    notice.className =
      "reserved-shipping-text reserved-color-only";


    notice.dataset.reservedKey =
      key;


    notice.innerHTML =
      '<span class="reserved-shipping-date">'
      + escapeHtml(message)
      + '</span>'
      + '<span class="reserved-shipping-badge">'
      + '예약배송'
      + '</span>';



    /*
      컬러칩형
    */

    if (
      colorInfo.type === "chip" &&
      colorInfo.element
    ) {

      const parent =
        colorInfo.element.parentElement;


      if (parent) {

        parent.appendChild(
          notice
        );

      }


      return;

    }



    /*
      컬러 드롭다운형
    */

    if (
      colorInfo.type ===
      "dropdown"
    ) {

      const groups =
        getOptionGroups(root);


      const colorGroup =
        groups.find(group =>
          isColorName(group.title)
        );


      if (!colorGroup) return;


      colorGroup.element.appendChild(
        notice
      );

    }

  }



  /* ========================================
     12. 현재 컬러에 없는 이전 문구 정리
  ======================================== */

  function cleanupStaleSizeNotices(
    root,
    activeKeys
  ) {

    root.querySelectorAll(
      ".reserved-shipping-text[data-reserved-key]"
    )
      .forEach(notice => {


        if (
          notice.classList.contains(
            "reserved-color-only"
          )
        ) {
          return;
        }


        const key =
          notice.dataset.reservedKey;


        if (
          !activeKeys.has(key)
        ) {


          const item =
            notice.closest(
              ".dropdown-item"
            );


          notice.remove();


          if (item) {

            item.classList.remove(
              "has-reserved-shipping"
            );

          }

        }

      });

  }



  /* ========================================
     13. 사이즈 문구만 정리
  ======================================== */

  function cleanupSizeNotices(root) {

    root.querySelectorAll(
      ".reserved-shipping-text:not(.reserved-color-only)"
    )
      .forEach(el =>
        el.remove()
      );


    root.querySelectorAll(
      ".has-reserved-shipping"
    )
      .forEach(el => {

        el.classList.remove(
          "has-reserved-shipping"
        );

      });

  }



  /* ========================================
     14. 관리 문구 전체 정리
  ======================================== */

  function cleanupAllManagedNotices(
    root
  ) {

    root.querySelectorAll(
      ".reserved-shipping-text[data-reserved-key]"
    )
      .forEach(el =>
        el.remove()
      );


    root.querySelectorAll(
      ".has-reserved-shipping"
    )
      .forEach(el => {

        el.classList.remove(
          "has-reserved-shipping"
        );

      });

  }



  /* ========================================
     15. 드롭다운 컬러값 추출
  ======================================== */

  function extractDropdownItemText(
    item
  ) {

    const candidates = [
      ...item.querySelectorAll(
        "a._requireOption span.blocked"
      )
    ];


    for (
      const element
      of candidates
    ) {

      const text =
        cleanText(
          element.textContent
        );


      if (text) {
        return text;
      }

    }


    return cleanText(
      item.textContent
    );

  }



  /* ========================================
     16. 사이즈값 추출
  ======================================== */

  function extractSizeText(
    item
  ) {

    const preferred =
      item.querySelector(
        "span.margin-bottom-lg"
      );


    if (preferred) {

      const text =
        cleanText(
          preferred.textContent
        );


      if (text) {
        return text;
      }

    }



    const option =
      item.querySelector(
        "a._requireOption span.blocked"
      );


    if (option) {

      const text =
        cleanText(
          option.textContent
        );


      if (text) {
        return text;
      }

    }


    return "";

  }



  /* ========================================
     UTIL
  ======================================== */

  function cleanText(value) {

    return String(
      value || ""
    )
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .trim();

  }


  function cleanOptionTitle(
    value
  ) {

    return cleanText(value)
      .replace(
        /\(필수\)/gi,
        ""
      )
      .trim();

  }


  function normalizeOption(
    value
  ) {

    return cleanText(value)
      .toLowerCase();

  }


  function normalizeDomain(
    value
  ) {

    return String(
      value || ""
    )
      .replace(
        /^https?:\/\//i,
        ""
      )
      .replace(
        /^www\./i,
        ""
      )
      .replace(
        /\/.*$/,
        ""
      )
      .toLowerCase()
      .trim();

  }


  function isColorName(
    value
  ) {

    const text =
      cleanOptionTitle(value)
        .toLowerCase();


    return COLOR_NAMES.some(
      name =>
        text === name ||
        text.startsWith(
          name + " "
        )
    );

  }


  function isSizeName(
    value
  ) {

    const text =
      cleanOptionTitle(value)
        .toLowerCase();


    return SIZE_NAMES.some(
      name =>
        text === name ||
        text.startsWith(
          name + " "
        )
    );

  }


  function isPlaceholder(
    value,
    names
  ) {

    const text =
      cleanOptionTitle(value)
        .toLowerCase();


    return names.some(
      name =>
        text === name ||
        text ===
        name + " 필수"
    );

  }


function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

})();
