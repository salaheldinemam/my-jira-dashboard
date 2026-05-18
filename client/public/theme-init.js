(function () {
  try {
    var raw = localStorage.getItem("jira-insights-ui");
    var theme = "system";
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed.state && parsed.state.theme) theme = parsed.state.theme;
    }
    var dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
