<template>
  <div class="navbar-wrapper">
    <img src="/border_corner.png" class="navbar-corner corner-bl" alt="" />
    <img src="/border_corner.png" class="navbar-corner corner-br" alt="" />
    <div class="border-left-edge navbar-left-edge">
      <img src="/border_left.png" class="border-edge-img" alt="" />
    </div>
    <div class="border-right-edge navbar-right-edge">
      <img src="/border_left.png" class="border-edge-img" alt="" />
    </div>
    <div class="border-bottom-edge navbar-bottom-edge">
      <img src="/border_top.png" class="border-edge-img" alt="" />
    </div>
    <div class="navbar">
      <a href="#">Início</a>
      <span class="nav-sep">-</span>
      <a href="#">Regras</a>
      <span class="nav-sep">-</span>
      <a href="#">Estatísticas dos mundos</a>
      <span class="nav-sep">-</span>
      <a href="#">Rodadas speed</a>
      <span class="nav-sep">-</span>
      <a href="#">Suporte</a>
      <span class="nav-sep">-</span>
      <a href="#">Ajuda</a>
      <span class="nav-sep">-</span>
      <a href="#">Fórum</a>
    </div>
  </div>
</template>

<style scoped>
.navbar-wrapper {
  position: relative;
  max-width: 800px;
  margin: 0 auto;
  background: transparent;
  padding: 0 0 12px 0;
}
.navbar {
  background-image: url('/login_bg.jpg');
  background-repeat: repeat;
  background-size: auto;
  text-align: center;
  padding: 5px 20px;
  margin: 10px 20px 4px;
}
.navbar-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  z-index: 10;
}
.navbar-corner.corner-bl { bottom: 0; left: 0; transform: scaleY(-1); }
.navbar-corner.corner-br { bottom: 0; right: 0; transform: scale(-1, -1); }
.navbar-left-edge  { top: 0 !important; bottom: 20px !important; }
.navbar-right-edge { top: 0 !important; bottom: 20px !important; }
.navbar-bottom-edge { bottom: 0 !important; }
.border-left-edge,
.border-right-edge {
  position: absolute;
  top: 20px;
  bottom: 20px;
  width: 20px;
  overflow: hidden;
  z-index: 9;
}
.border-left-edge  { left: 0; }
.border-right-edge { right: 0; transform: scaleX(-1); }
.border-bottom-edge {
  position: absolute;
  left: 20px;
  right: 20px;
  height: 20px;
  overflow: hidden;
  z-index: 9;
  bottom: 0;
  transform: scaleY(-1);
}
.border-edge-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.navbar a { color: #804000; text-decoration: none; font-size: 13px; font-weight: bold; }
.navbar a:hover { text-decoration: underline; }
.nav-sep { color: #8b6535; margin: 0 6px; }

@media (max-width: 768px) {
  .navbar-wrapper {
    max-width: 100%;
    padding: 0 0 12px 0;
  }
  .navbar {
    margin: 10px 20px 4px;
    padding: 6px 10px;
    line-height: 2;
    font-size: 12px;
  }
  .navbar a { font-size: 12px; }
}
</style>
