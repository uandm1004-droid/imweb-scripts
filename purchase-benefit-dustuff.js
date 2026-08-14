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


  let sheetBenefits = [];

  const discountCache =
    new Map();



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

      /*
        현재 사이트 + 현재 상품 +
        기능=구매혜택만 추출
      */

      sheetBenefits =
        data.filter(function (item) {

          return (
            item.enabled !== false &&
            normalizeDomain(item.domain) === currentDomain &&
            String(item.productId) === String(currentIdx) &&
            cleanText(item.type) === "구매혜택"
          );

        });


      initPurchaseBenefit();

    })

    .catch(function (error) {

      console.error(
        "구매혜택 데이터 불러오기 실패:",
        error
      );


      /*
        시트 연결 실패 시에도
        기존 HTML 방식은 살림
      */

      initLegacyBenefit();

    });



  /* ========================================
     2. 구매혜택 초기화
  ======================================== */

  function initPurchaseBenefit() {

    /*
      시트에서 실제 사용 가능한 설정이 있는지 확인
    */

    const validSheetBenefits =
      sheetBenefits.filter(function (item) {

        return (
          cleanText(item.message) &&
          cleanText(item.setupProductId)
        );

      });


    /*
      구글시트 설정 있음
      → 신규 방식
    */

    if (validSheetBenefits.length) {

      waitForDeliverySection(function (deliverySection) {

        injectSheetBenefit(
          deliverySection,
          validSheetBenefits
        );

      });

      return;

    }


    /*
      구글시트 설정 없음
      → 기존 상품 HTML 방식
    */

    initLegacyBenefit();

  }



  /* ========================================
     3. 배송정보 영역 대기
  ======================================== */

  function waitForDeliverySection(callback) {

    const immediate =
      getDeliverySection();


    if (immediate) {

      callback(immediate);
      return;

    }


    const observer =
      new MutationObserver(function () {

        const deliverySection =
          getDeliverySection();


        if (!deliverySection) {
          return;
        }


        observer.disconnect();

        callback(deliverySection);

      });


    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

  }



  function getDeliverySection() {

    return document.querySelector(
      ".prod-detail-section.prod-detail-section--delivery"
    );

  }



  /* ========================================
     4. 구글시트 방식 구매혜택
  ======================================== */

  async function injectSheetBenefit(
    deliverySection,
    settings
  ) {

    /*
      중복 방지
    */

    if (
      document.querySelector(
        ".purchase-benefit-injected"
      )
    ) {
      return;
    }


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


      /*
        연결된 셋업 상품 할인율 조회
      */

      const discount =
        await getSetupDiscount(
          setupProductId
        );


      /*
        예:

        시트:
        할인 받고 셋업으로 구매하러 가기→

        셋업 상품:
        15%

        결과:
        15% 할인 받고 셋업으로 구매하러 가기→
      */

      const finalText =
        discount
          ? discount + " " + baseMessage
          : baseMessage;


      items.push({

        text: finalText,

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
      비동기 처리 중 중복 생성 방지
    */

    if (
      document.querySelector(
        ".purchase-benefit-injected"
      )
    ) {
      return;
    }



    applyDeliverySectionStyle(
      deliverySection
    );



    /* ========================================
       구매 혜택 섹션 생성
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



      paragraph.appendChild(
        link
      );


      content.appendChild(
        paragraph
      );

    });



    benefitWrap.appendChild(
      title
    );


    benefitWrap.appendChild(
      content
    );



    /*
      예약배송 상세 정보가 있는 사이트라면
      그 아래 배치.

      없으면 기존 배송정보 바로 아래.
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
     5. 기존 HTML 호환 방식
  ======================================== */

  function initLegacyBenefit() {

    function injectLegacyBenefit() {

      const deliverySection =
        getDeliverySection();


      if (!deliverySection) {
        return false;
      }


      /*
        이미 시트/기존 방식 중 하나가 출력됐다면
        중복 생성하지 않음
      */

      if (
        document.querySelector(
          ".purchase-benefit-injected"
        )
      ) {
        return true;
      }


      /*
        기존 상품페이지 HTML

        .benefit-setup
      */

      const targets = [
        ...document.querySelectorAll(
          "#prod_detail_body .benefit-setup"
        )
      ]
        .reverse()
        .filter(Boolean);


      if (!targets.length) {
        return false;
      }


      let injected =
        false;


      targets.forEach(function (target) {

        const originalWrap =
          target.querySelector(
            ".benefit-wrap"
          );


        if (!originalWrap) {
          return;
        }


        const cloned =
          originalWrap.cloneNode(true);


        cloned.classList.add(
          "purchase-benefit-injected"
        );


        applyDeliverySectionStyle(
          deliverySection
        );


        /*
          예약배송 상세 섹션 존재 시
          그 아래에 구매혜택 배치
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
          cloned
        );


        injected =
          true;

      });


      return injected;

    }



    /*
      즉시 한 번 확인
    */

    if (
      injectLegacyBenefit()
    ) {
      return;
    }



    /*
      아임웹 DOM 늦게 생성되는 경우 대응
    */

    const observer =
      new MutationObserver(function () {

        if (
          injectLegacyBenefit()
        ) {

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
     6. 배송 영역 스타일
  ======================================== */

  function applyDeliverySectionStyle(
    deliverySection
  ) {

    if (!deliverySection) {
      return;
    }


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

  }



  /* ========================================
     7. 셋업 상품 할인율 조회
  ======================================== */

  function getSetupDiscount(
    setupProductId
  ) {

    const key =
      String(
        setupProductId
      );


    /*
      같은 페이지 안에서
      같은 셋업 상품을 반복 조회하지 않음
    */

    if (
      discountCache.has(key)
    ) {

      return discountCache.get(
        key
      );

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
            더스터프 셋업 상품 할인율

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
     8. 셋업 상품 URL 생성
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
