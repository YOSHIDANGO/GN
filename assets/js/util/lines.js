// assets/js/util/lines.js
export function pick(arr){
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  export function fmt(s, vars = {}){
    if (!s) return '';
    return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  }
  