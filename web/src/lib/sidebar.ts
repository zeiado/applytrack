// Whether the app's sidebar is collapsed to icons, kept in this browser only. SIDEBAR_SCRIPT
// runs in <head> before the page paints and sets <html data-sidebar>, so the layout never
// jumps; CSS reads it through the `collapsed:` variant (globals.css).
const SIDEBAR_KEY = "sidebar";

export const SIDEBAR_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)})==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}})()`;

export function toggleSidebar(): void {
  const root = document.documentElement;
  const collapsed = root.dataset.sidebar !== "collapsed";
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Private mode: it still works for this page.
  }
}
