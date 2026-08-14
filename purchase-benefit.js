(function () {

  /* ========================================
     설정
  ======================================== */

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzHZKXnGomjSslR3C355roaWa7VYpcOdtzuAS7j9ZpT2QyGZAdf5OoYSqo5_DZRqBg/exec";

  const currentDomain =
    normalizeDomain(window.location.hostname);

  const currentIdx =
    new URLSearchParams(window.location.search).get("idx");

  if (!currentIdx) return;


  let benefitSettings = [];

  const discountCache = new Map();


  /* ========================================
     1. 구글시트 데이터 불러오기
  ======================================== */

  fetch(API_URL, {
    cache: "no-store"
  })

    .then(function (response) {

      if (!response.ok) {
        throw new Error(
          "API 응답 오류: " + response.status
        );
      }

      return response.json();

    })

    .then(function (data) {

      benefitSettings =
        data.filter(function (item) {

          return (
            item.enabled !== false &&
            normalizeDomain(item.domain) === currentDomain &&
            String(item.productId) === String(currentIdx) &&
            cleanText(item.type) === "구매혜택"
          );

        });


      if (!benefitSettings.length) {
        return;
      }


      initBenefit();

    })

    .catch(function (error) {

      console.error(
        "구매혜택 데이터 불러오기 실패:",
        error
      );

    });



  /* ========================================
     2. 구매혜택 초기화
  ======================================== */

  function initBenefit() {

    /*
      아임웹 상품 정보가 늦게 생성되는 경우를 위해
      MutationObserver 사용
    */

    if (injectBenefit()) {
      return;
    }


    const observer =
      new MutationObserver(function () {

        if (injectBenefit()) {
          observer.disconnect();
        }

      });


    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

  }



  /* ========================================
     3. 구매혜택 생성
  ======================================== */

  function injectBenefit() {

    const deliverySection =
      document.querySelector(
        ".prod-detail-section.prod-detail-section--delivery"
      );


    if (!deliverySection) {
      return false;
    }


    /*
      이미 생성했다면 중복 생성 방지
    */

    if (
      document.querySelector(
        ".purchase-benefit-injected"
      )
    ) {
      return true;
    }


    const validSettings =
      benefitSettings.filter(function (item) {

        return (
          cleanText(item.setupProductId) &&
          cleanText(item.message)
        );

      });


    if (!validSettings.length) {
      return true;
    }


    /*
      비동기 처리 시작
    */

    createBenefitSection(
      deliverySection,
      validSettings
    );


    return true;

  }



  /* ========================================
     4. 구매혜택 영역 생성
  ======================================== */

  async function createBenefitSection(
    deliverySection,
    settings
  ) {

    const items = [];


    for (const setting of settings) {

      const setupProductId =
        cleanText(
          setting.setupProductId
        );


      const baseMessage =
        cleanText(
          setting.message
        );


      if (
        !setupProductId ||
        !baseMessage
      ) {
        continue;
      }


      const discount =
        await getSetupDiscount(
          setupProductId
        );


      /*
        할인율이 있으면

        15% 할인 받고 셋업으로 구매하러 가기→

        할인율을 못 찾으면

        할인 받고 셋업으로 구매하러 가기→
      */

      const text =
        discount
          ? discount + " " + baseMessage
          : baseMessage;


      items.push({

        text: text,

        href:
          buildProductUrl(
            setupProductId
          )

      });

    }


    if (!items.length) {
      return;
    }


    /*
      비동기 처리 중 다른 호출에서
      이미 생성했을 가능성 방지
    */

    if (
      document.querySelector(
        ".purchase-benefit-injected"
      )
    ) {
      return;
    }



    /* ========================================
       배송 영역 하단 스타일
    ======================================== */

    deliverySection.style.setProperty(
      "border-bottom",
      "1px solid rgba(30, 30, 30, 0.1)",
      "important"
    );


    deliverySection.style.setProperty(
      "padding-bottom",
      "12px",
      "important"
    );



    /* ========================================
       구매혜택 영역
    ======================================== */

    const benefitWrap =
      document.createElement("div");


    benefitWrap.className =
      "purchase-benefit-injected prod-detail-section";


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



    items.forEach(function (item) {

      const paragraph =
        document.createElement("p");


      paragraph.className =
        "prod-detail-section__item";


      const link =
        document.createElement("a");


      link.href =
        item.href;


      link.textContent =
        item.text;


      paragraph.appendChild(link);

      content.appendChild(paragraph);

    });



    benefitWrap.appendChild(title);

    benefitWrap.appendChild(content);



    /*
      예약배송 기능도 사용하는 사이트라면
      예약배송 상세정보 아래에 배치

      예약배송이 없으면
      기본 배송정보 바로 아래에 배치
    */

    const reserveNotice =
      document.querySelector(
        ".prod-detail-section--reserve-notice"
      );


    const anchor =
      reserveNotice ||
      deliverySection;


    anchor.insertAdjacentElement(
      "afterend",
      benefitWrap
    );

  }



  /* ========================================
     5. 셋업 상품 할인율 가져오기
  ======================================== */

  function getSetupDiscount(
    setupProductId
  ) {

    const key =
      String(setupProductId);


    /*
      동일 상품을 반복해서 불러오지 않도록
      페이지 내 캐시
    */

    if (
      discountCache.has(key)
    ) {

      return discountCache.get(key);

    }


    const request =
      fetch(
        buildProductUrl(
          setupProductId
        ),
        {
          cache: "no-store",
          credentials: "same-origin"
        }
      )

        .then(function (response) {

          if (!response.ok) {

            throw new Error(
              "셋업 상품 조회 실패: "
              + response.status
            );

          }


          return response.text();

        })

        .then(function (html) {

          const doc =
            new DOMParser()
              .parseFromString(
                html,
                "text/html"
              );


          /*
            아임웹 할인율

            <span class="sale_percentage">
              15%
            </span>
          */

          const discountElement =
            doc.querySelector(
              ".sale_percentage"
            );


          if (!discountElement) {
            return "";
          }


          return cleanText(
            discountElement.textContent
          );

        })

        .catch(function (error) {

          console.error(
            "셋업 상품 할인율 조회 실패 (idx="
            + setupProductId
            + "):",
            error
          );


          return "";

        });


    discountCache.set(
      key,
      request
    );


    return request;

  }



  /* ========================================
     6. 상품 URL 생성
  ======================================== */

  function buildProductUrl(
    productId
  ) {

    const url =
      new URL(
        "/shop_view",
        window.location.origin
      );


    url.searchParams.set(
      "idx",
      String(productId)
    );


    return url.toString();

  }



  /* ========================================
     UTIL
  ======================================== */

  function cleanText(value) {

    return String(
      value || ""
    )
      .replace(/\s+/g, " ")
      .trim();

  }


  function normalizeDomain(value) {

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

})();
