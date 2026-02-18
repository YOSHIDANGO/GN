// assets/js/util/damage.js
export function calcDamage(att, def, power = 1.0, opts = {}){
    const atk = att?.atk ?? 10;
    const df  = def?.def ?? 5;
  
    const crit = att?.crit ?? 0.0;
    const eva  = def?.eva  ?? 0.0;
  
    const isMiss = Math.random() < eva;
    const isCrit = !isMiss && (Math.random() < crit);
  
    if (isMiss){
      return { dmg: 0, isCrit: false, isMiss: true };
    }
  
    // ---- multipliers (全部デフォルト1で互換) ----
    const tagResist        = (typeof opts.tagResist === 'number') ? opts.tagResist : 1.0;
    const moodMultiplier   = (typeof opts.moodMultiplier === 'number') ? opts.moodMultiplier : 1.0;
    const streakMultiplier = (typeof opts.streakMultiplier === 'number') ? opts.streakMultiplier : 1.0;
  
    // ---- rand ----
    const randMin = (typeof opts.randMin === 'number') ? opts.randMin : 0.90;
    const randMax = (typeof opts.randMax === 'number') ? opts.randMax : 1.10;
    const rand = randMin + Math.random() * (randMax - randMin);
  
    // ---- base formula (formulas.json に寄せる) ----
    // max(1, (atk-def)*power*rand*tagResist*moodMultiplier*streakMultiplier)
    let raw = (atk - df) * power * rand * tagResist * moodMultiplier * streakMultiplier;
  
    let base = Math.max(1, Math.floor(raw));
  
    // ---- crit ----
    const critMul = (typeof opts.critMul === 'number') ? opts.critMul : 1.6;
    if (isCrit) base = Math.max(1, Math.floor(base * critMul));
  
    return { dmg: base, isCrit, isMiss: false };
  }
  