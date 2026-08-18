(function () {

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzHZKXnGomjSslR3C355roaWa7VYpcOdtzuAS7j9ZpT2QyGZAdf5OoYSqo5_DZRqBg/exec";

  const domain =
    normalizeDomain(location.hostname);

  const productId =
    new URLSearchParams(location.search).get("idx");

  if (!productId) return;

  init();


  async function init() {

    try {

      const response =
        await fetch(API_URL, {
          cache: "no-store"
        });

      if (!response.ok) {
        throw new Error(
          "API 오류: " + response.status
        );
      }

      const data =
        await response.json();


      /* 현재 상품의 구매혜택만 */
      const benefits =
        data.filter(function (item) {

          return (
            item.enabled !== false &&
            normalizeDomain(item.domain) === domain &&
            String(item.productId) === String(productId) &&
            cleanText(item.type) === "구매혜택" &&
            cleanText(item.setupProductId)
          );

        });


      if (!benefits.length) return;


      const container =
        await waitFor("#prod_detail_body");

      const currentTitleEl =
        await waitFor("h1.view_tit");


      if (!container || !currentTitleEl) return;


      const currentProductName =
        getProductTitle(currentTitleEl);


      /* 재실행 시 기존 시트 생성본 제거 */
      container
        .querySelectorAll(".benefit-setup--sheet")
        .forEach(function (el) {
          el.remove();
        });


      const fragment =
        document.createDocumentFragment();


      benefits.forEach(function (benefit) {

        const setupId =
          cleanText(
            benefit.setupProductId
          );


        const setupTitle =
          cleanText(
            benefit.setupTitle
          );


        const discount =
          cleanText(
            benefit.discount
          );


        const counterpart =
          getCounterpartName(
            setupTitle,
            currentProductName
          );


        let message =
          cleanText(
            benefit.message
          ) ||
          "할인 받고 {상품명} 셋업으로 구매하러 가기→";


        /* {상품명} 치환 */
        message =
          message.replace(
            /\{상품명\}/g,
            counterpart
          );


        /*
          할인 있음
          → 15% 할인 받고 A Pants 셋업으로...

          할인 없음
          → A Pants 셋업으로...
        */
        if (discount) {

          message =
            discount + " " + message;

        } else {

          message =
            message.replace(
              /^할인\s*받고\s*/i,
              ""
            );

        }


        const target =
          document.createElement("div");


        target.className =
          "benefit-setup benefit-setup--sheet";


        target.style.display =
          "none";


        const wrap =
          document.createElement("div");


        wrap.className =
          "benefit-wrap prod-detail-section";


        wrap.style.display =
          "flex";


        const title =
          document.createElement("div");


        title.className =
          "prod-detail-section__title";


        title.textContent =
          "구매 혜택";


        const content =
          document.createElement("div");


        content.className =
          "prod-detail-section__content";


        const p =
          document.createElement("p");


        p.className =
          "prod-detail-section__item";


        const a =
          document.createElement("a");


        a.href =
          buildProductUrl(setupId);


        a.textContent =
          message;


        p.appendChild(a);

        content.appendChild(p);

        wrap.appendChild(title);

        wrap.appendChild(content);

        target.appendChild(wrap);

        fragment.appendChild(target);

      });


      /*
        모든 benefit-setup을 한 번에 추가
        → 기존 injectBenefit()이 전부 한 번에 감지
      */
      container.appendChild(fragment);


    } catch (error) {

      console.error(
        "구매혜택 시트 생성 오류:",
        error
      );

    }

  }


  /* ========================================
     SET 상품명 → 짝 상품명
  ======================================== */

  function getCounterpartName(
    setupTitle,
    currentProductName
  ) {

    const parts =
      cleanText(setupTitle)
        .replace(/\s+SET$/i, "")
        .split("/")
        .map(cleanText)
        .filter(Boolean);


    const current =
      normalizeProductName(
        currentProductName
      );


    return (
      parts.find(function (name) {

        return (
          normalizeProductName(name)
          !== current
        );

      }) || ""
    );

  }


  /* ========================================
     현재 상품명 추출
     NEW / SALE 배지 제외
  ======================================== */

  function getProductTitle(element) {

    if (!element) return "";


    const clone =
      element.cloneNode(true);


    clone
      .querySelectorAll(".ns-icon")
      .forEach(function (el) {
        el.remove();
      });


    return cleanText(
      clone.textContent
    );

  }


  /* ========================================
     DOM 대기
  ======================================== */

  function waitFor(selector) {

    return new Promise(function (resolve) {

      const found =
        document.querySelector(selector);


      if (found) {
        resolve(found);
        return;
      }


      const observer =
        new MutationObserver(function () {

          const element =
            document.querySelector(selector);


          if (!element) return;


          observer.disconnect();

          resolve(element);

        });


      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

    });

  }


  /* ========================================
     상품 URL
  ======================================== */

  function buildProductUrl(id) {

    const url =
      new URL(
        "/shop_view",
        location.origin
      );


    url.searchParams.set(
      "idx",
      String(id)
    );


    return url.toString();

  }


  /* ========================================
     UTIL
  ======================================== */

  function cleanText(value) {

    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  }


  function normalizeProductName(value) {

    return cleanText(value)
      .replace(/\s+SET$/i, "")
      .toLowerCase()
      .trim();

  }


  function normalizeDomain(value) {

    return String(value || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/.*$/, "")
      .toLowerCase()
      .trim();

  }

})();
