
export function randRange(min, max){ return min + Math.random()*(max-min); }

// Walk-distance based random encounter
export function makeEncounterCounter(){
  return { acc: 0, threshold: randRange(420, 840) };
}

export function addSteps(counter, dist){
  counter.acc += dist;
  if (counter.acc >= counter.threshold){
    counter.acc = 0;
    counter.threshold = randRange(180, 420);
    return true;
  }
  return false;
}

export function pickGuestId(){
    const r = Math.random();
  
    // 社長だけレア
    if (r < 0.02) return 'ceo';
  
    // それ以外は完全に同率
    const others = [
      'salaryman',
      'tourist',
      'regular',
      'elite',
      'foreign'
    ];
  
    return others[Math.floor(Math.random() * others.length)];
  }
  
