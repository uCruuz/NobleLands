<template>
  <div class="border-box-wrapper">
    <img src="/border_corner.png" class="border-corner corner-tl" alt="" />
    <img src="/border_corner.png" class="border-corner corner-tr" alt="" />
    <img src="/border_corner.png" class="border-corner corner-bl" alt="" />
    <img src="/border_corner.png" class="border-corner corner-br" alt="" />

    <div class="border-top-edge">
      <img src="/border_top.png" class="border-edge-img" alt="" />
    </div>
    <div class="border-bottom-edge">
      <img src="/border_top.png" class="border-edge-img" alt="" />
    </div>
    <div class="border-left-edge">
      <img src="/border_left.png" class="border-edge-img" alt="" />
    </div>
    <div class="border-right-edge">
      <img src="/border_left.png" class="border-edge-img" alt="" />
    </div>

    <div class="border-box-inner">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.border-box-wrapper {
  position: relative;
}
.border-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  z-index: 10;
  display: block;
}
.corner-tl { top: 0; left: 0; }
.corner-tr { top: 0; right: 0; transform: scaleX(-1); }
.corner-bl { bottom: 0; left: 0; transform: scaleY(-1); }
.corner-br { bottom: 0; right: 0; transform: scale(-1, -1); }

.border-top-edge,
.border-bottom-edge {
  position: absolute;
  left: 20px;
  right: 20px;
  height: 20px;
  overflow: hidden;
  z-index: 9;
}
.border-top-edge { top: 0; }
.border-bottom-edge { bottom: 0; transform: scaleY(-1); }

.border-left-edge,
.border-right-edge {
  position: absolute;
  top: 20px;
  bottom: 20px;
  width: 20px;
  overflow: hidden;
  z-index: 9;
}
.border-left-edge { left: 0; }
.border-right-edge { right: 0; transform: scaleX(-1); }

.border-edge-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.border-box-inner {
  margin: 20px;
}
</style>
