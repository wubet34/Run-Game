// ui.js — HUD and screen management

export class UI {
  constructor() {
    this.startScreen   = document.getElementById('start-screen');
    this.hud           = document.getElementById('hud');
    this.pauseScreen   = document.getElementById('pause-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');

    this.scoreVal    = document.getElementById('score-val');
    this.coinVal     = document.getElementById('coin-val');
    this.distanceVal = document.getElementById('distance-val');

    this.finalScore    = document.getElementById('final-score');
    this.finalDistance = document.getElementById('final-distance');
    this.finalCoins    = document.getElementById('final-coins');
    this.highScore     = document.getElementById('high-score');

    this._highScore = parseInt(localStorage.getItem('templeDashHigh') || '0');
  }

  showStart() {
    this._show(this.startScreen);
    this._hide(this.hud);
    this._hide(this.pauseScreen);
    this._hide(this.gameoverScreen);
  }

  showHUD() {
    this._hide(this.startScreen);
    this._show(this.hud);
    this._hide(this.pauseScreen);
    this._hide(this.gameoverScreen);
  }

  showPause() {
    this._show(this.pauseScreen);
  }

  hidePause() {
    this._hide(this.pauseScreen);
  }

  showGameOver(score, distance, coins) {
    this._hide(this.hud);
    this._show(this.gameoverScreen);

    if (score > this._highScore) {
      this._highScore = score;
      localStorage.setItem('templeDashHigh', score);
    }

    this.finalScore.textContent    = score;
    this.finalDistance.textContent = distance + 'm';
    this.finalCoins.textContent    = coins;
    this.highScore.textContent     = this._highScore;
  }

  updateHUD(score, coins, distance) {
    this.scoreVal.textContent    = score;
    this.coinVal.textContent     = coins;
    this.distanceVal.textContent = Math.floor(distance);
  }

  _show(el) {
    el.classList.remove('hidden');
    el.classList.add('active');
  }

  _hide(el) {
    el.classList.remove('active');
    el.classList.add('hidden');
  }
}
