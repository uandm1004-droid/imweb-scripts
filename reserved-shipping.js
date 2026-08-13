<!-- Uneedcomms Keepgrow Script -->
<script id="kg-service-init" data-hosting="imweb" src="//storage.keepgrow.com/admin/keepgrow-service/keepgrow-service_5b96deb1-6231-4543-971e-864badf11a71.js"></script>
<!-- Uneedcomms Keepgrow Script -->

<style>
  /* 🔴 mo 여백 */
  @media (max-width:991px){
    /* 기획 */
    #container_w20250107fab2ace6f9226 > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w20250107fab2ace6f9226 > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    /* 기획 */
    #container_w2025080585057406eedf4 > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w2025080585057406eedf4 > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    /* cody set */
    #container_w20250423b36ac432516a0 > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w20250423b36ac432516a0 > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    /* 블프 */
    #container_w2025110522c707e79974e > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w2025110522c707e79974e > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    /* best */
    #container_w202409100008b88a6c5ab > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w202409100008b88a6c5ab > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    /* new */
    #container_w202409100b9a4e1ee2bcc > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w202409100b9a4e1ee2bcc > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    /* shop */
    #container_w20240910862e0b07e5e3d > div:nth-of-type(2n-1).shop-item._shop_item{
      padding-left: 16px!important; padding-right: 4px!important;
    }
    #container_w20240910862e0b07e5e3d > div:nth-of-type(2n).shop-item._shop_item{
      padding-right: 16px!important; padding-left: 4px!important;
    }
    
    .shop-tools.clearfix{padding: 0 8px;}

    .type-list .shop-item,
    .thumb-row .shop-item{margin-bottom: 10px !important;}
    
    .item-detail .item-pay h2,
    .item-detail .item-pay .pay,
    .item-detail .item-pay .sale_percentage{font-size: 11px !important;}
  }
  
  .goods_summary .justenter-content{padding: 15px 20px 10px; background-color: #f7f7f7;}    
  .goods_summary u{text-underline-offset: 5px; text-decoration-thickness: 1px; font-size: 16px!important;}
    
  /* 🔴 말풍선 디자인 */
  div.tooltip-inner{font-family: 'ivyora-display','Noto Serif'; border-radius: 15px; color: #fff!important;}
  
  /* 🔴 가격 */
  div.item-pay-detail > p{display: inline-block;}
  .shop-item .item-detail .item-pay-detail .pay{
    background-color: #1e1e1e;
    padding: 2px 5px;
    color: #fff !important;
  }
  
  /* 🔴 쿠폰받기 & 상세설명 */
  #prod_goods_form > header{border-width: 0px;}
  #prod_goods_form .prod-detail-coupon-container{
    border-radius: 0px!important; border-color: #1e1e1e;
    background-color: #fff;
  } 
  #prod_goods_form .prod-detail-coupon-container .btn-coupon-square{
    border-radius: 0px!important; border-color: #1e1e1e;
  }
  
/* 🔴 팝업 */
  .pop-container .btn-group{
    background-color: rgba(255,255,255,0)!important;
  }
  .pop-container .btn-group a{
    background-color: rgba(255,255,255,0.7)!important;
  }
  .pop-container .btn-group a:hover{
    background-color: rgba(255,255,255,0.9)!important;
  }
  .pop-container .btn-group .btn+.btn{
    border-width: 0px;
  }
  #popup_S2023021955b04ac44d8da_310700{
    position: fixed!important; top: auto!important; bottom: 100px;
  }
  #popup_S20240906819d4cc447bb4_269291{
    position: fixed!important;
  }
  @media (max-width:991px){
    #popup_S2023021955b04ac44d8da_310700,
    #popup_S20240906819d4cc447bb4_269291{
      width: 80%; left: 10%!important;
      top: auto!important; bottom: 80px!important;
    }
  }
  
/* 🔴 sold out */
  .soldout-overlay {
    position: absolute; top: 0; left: 0; z-index: 2; 
    width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    color: white; font-weight: bold; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .item-thumbs {position: relative;}
</style>

<script>
  // sold out
  setInterval(function () {
    $('.sold_out').each(function () {
      const $itemDetail = $(this).closest('.item-detail');
      const $itemThumbs = $itemDetail.siblings('.item-wrap, .item-thumbs');
  
      // 중복 방지용 클래스 검사 (더 명확한 클래스 사용)
      if (!$itemThumbs.hasClass('overlay-processed')) {
        $itemThumbs.addClass('overlay-processed');
  
        if ($itemThumbs.find('.soldout-overlay').length === 0) {
          $itemThumbs.append('<div class="soldout-overlay">SOLD OUT</div>');
        }
      }
    });
  }, 500);
</script>

<style>
/* 🔴 뱃지 디자인 */
  .prod_icon.timesale,
  .prod_icon.sold_out,
  .prod_icon.sale{
    display: none;
  }
  
/* 🔴 timesale */
  .shop-item._shop_item{position: relative;}
  .shop-item._shop_item h2{display: block; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;}

/* 슬라이더에서 타이머 숨기기 */
  .doz-timesale-wrap._doz_timesale_wrap i{display: none;}
    
/* 🔴 timer */
  .item-detail .doz-timesale-wrap{
	display: none;
  }
  .je-timer-ghost{
    display: block !important;
	position: absolute; bottom: 0px; left: 0; right: 0;
	width: 100%;
	padding: 3px;
	background-color: rgba(0,0,0,0.5);
	text-align: center;
	color: #fff; font-size: 16px; font-weight: 600; letter-spacing: 1px;
    pointer-events: none;
    -webkit-transform: translateZ(0);
  }
</style>

<script>
  // 🔴 timer
  (function(){
    // 유틸
    var $ = function(sel, root){ return (root||document).querySelector(sel); };
    var $$ = function(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };
  
    // 카드(두 구조 모두) + 썸네일 후보(두 구조 모두)
    var CARD_SEL  = '.shop-item, .shop-item__shop_item';
    var THUMB_CANDIDATES = [
      '.item-overlay',        // 기획전
      '.item-thumbs',         // 기획전
      'a.shop-item-thumb',    // 일반 쇼핑(핵심)
      '.thumb', '.thumb-fluid', '.prod_img'
    ];
  
    // 보이는 첫 컨테이너 고르기
    function pickThumb(card){
      for(var i=0;i<THUMB_CANDIDATES.length;i++){
        var t = $(THUMB_CANDIDATES[i], card);
        if(!t) continue;
        var cs = getComputedStyle(t);
        if(cs.display !== 'none' && cs.visibility !== 'hidden' && t.offsetParent !== null){
          return t;
        }
      }
      var img = $('img', card);
      return img ? img.parentElement : null;
    }
  
    // 각 카드에서 data-end-time 찾기
    function findEndTs(card){
      var node = card.querySelector('[data-end-time]');
      if(!node) return null;
      var ts = parseInt(node.getAttribute('data-end-time'), 10);
      return Number.isFinite(ts) ? ts : null;
    }
  
    // 고스트 생성 (end-time이 있는 카드만)
    function ensureGhostBars(ctx){
      $$(CARD_SEL, ctx).forEach(function(card){
        var end = findEndTs(card);
        if(end == null || end <= 0) return; // end-time 없거나 0 이하이면 생성 안 함

        var target = pickThumb(card);
        if(!target) return;

        target.classList.add('je-thumb-root');
        if(!$('.je-timer-ghost', target)){
          var div = document.createElement('div');
          div.className = 'je-timer-ghost';
          div.textContent = '--:--:--:--';
          target.insertBefore(div, target.firstChild);
        }
      });
    }
  
    // 초 -> DD:HH:MM:SS
    function fmt(rem){
      if(rem < 0) rem = 0;
      var dd = Math.floor(rem/86400); rem%=86400;
      var hh = Math.floor(rem/3600);  rem%=3600;
      var mm = Math.floor(rem/60);    var ss = Math.floor(rem%60);
      var z = function(n){ return ('0'+n).slice(-2); };
      return z(dd)+':'+z(hh)+':'+z(mm)+':'+z(ss);
    }
  
    // 1초마다 업데이트
    function tick(){
      $$('.je-timer-ghost').forEach(function(ghost){
        var card = ghost.closest(CARD_SEL);
        if(!card){ ghost.remove(); return; }
        var end = findEndTs(card);
        if(end == null || end <= 0){ ghost.remove(); return; }
        var left = end - Math.floor(Date.now()/1000);
        if(left <= 0){ ghost.remove(); return; }
        ghost.textContent = fmt(left);
      });
    }
  
    // 초기 실행 + 지연 로딩 대비
    function kickoff(){
      ensureGhostBars(document);
      var n=0, iv=setInterval(function(){
        ensureGhostBars(document);
        if(++n>4) clearInterval(iv);
      }, 600);
      if(!window.__jeTimerLoop){
        window.__jeTimerLoop = setInterval(tick, 1000);
      }
    }
  
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', kickoff);
    } else { kickoff(); }
  
    // 아임웹 비동기 갱신 후에도 생성
    document.addEventListener('ajaxStop', function(){ ensureGhostBars(document); }, true);
  })();
</script>
