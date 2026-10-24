/* Boot: wire everything up and start the first scene (?scene=id, last used, or the first). */
(function () {
  const W = window.Lumevale;
  W.engine.init();
  W.theme.init();
  W.widgets.init();
  W.ui.init();
  const fromUrl = new URLSearchParams(location.search).get('scene');
  const ids = W.scenes.map((d) => d.id);
  const first = [fromUrl, W.settings.get('scene')].find((id) => ids.includes(id)) || ids[0];
  W.engine.switchTo(first);
})();
