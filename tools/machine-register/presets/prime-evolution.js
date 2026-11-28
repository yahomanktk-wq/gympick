// 2026-11-27: PRIME Evolution 시리즈 12종 프리셋
// 출처: https://www.primefitnessusa.com/collections/evolution (products.json 첫 이미지)
// 카테고리는 DB에서 가장 많이 쓰는 표기에 맞춤 (예: Leg Extention 156건 > Leg Extension 13건)
window.GYMPICK_PRESETS = window.GYMPICK_PRESETS || [];
window.GYMPICK_PRESETS.push({
  key: 'prime-evolution',
  label: 'PRIME Evolution 12종',
  source: 'https://www.primefitnessusa.com/collections/evolution',
  items: [
    { name: 'ABDOMINAL CRUNCH',   muscles: ['Other'],    cats: ['Etc'],            image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/Evolution-Abdominal-Crunch-800x600-WHT.jpg?v=1635874669' },
    { name: 'ARM CURL',           muscles: ['Arms'],     cats: ['Biceps'],         image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/PRIME-Evolution-Arm-Curl-Web.jpg?v=1635960878' },
    { name: 'CHEST PRESS',        muscles: ['Chest'],    cats: ['Chest Press'],    image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/PRIME-Evolution-Chest-Press-Web.jpg?v=1635960688' },
    { name: 'LAT PULLDOWN',       muscles: ['Back'],     cats: ['Pull Down'],      image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/EVOLatPulldownNEWHandles.jpg?v=1638215358' },
    { name: 'LEG EXTENSION',      muscles: ['Leg'],      cats: ['Leg Extention'],  image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/PRIME-Evolution-Leg-Extension-Web.jpg?v=1635960380' },
    { name: 'LEG PRESS',          muscles: ['Leg'],      cats: ['Leg Press'],      image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/PRIME-Evolution-Leg-Press-Web.jpg?v=1635876220' },
    { name: 'LOW BACK EXTENSION', muscles: ['Back'],     cats: ['Back_Etc'],       image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/Evolution-Low-Back-Extension-800x600-WHT.jpg?v=1635874318' },
    { name: 'PRONE LEG CURL',     muscles: ['Leg'],      cats: ['Leg Curl'],       image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/Evolution-Prone-Leg-Curl-800x600-WHT.jpg?v=1635960547' },
    { name: 'SEATED LEG CURL',    muscles: ['Leg'],      cats: ['Leg Curl'],       image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/Evolution-Seated-Leg-Curl.jpg?v=1638036328' },
    { name: 'SEATED ROW',         muscles: ['Back'],     cats: ['Middle Row'],     image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/files/E-128FrontStdHand-1208882A.jpg?v=1708353857' },
    { name: 'SHOULDER PRESS',     muscles: ['Shoulder'], cats: ['Shoulder Press'], image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/PRIME-Evolution-Shoulder-Press-Web.jpg?v=1635875316' },
    { name: 'TRICEP EXTENSION',   muscles: ['Arms'],     cats: ['Triceps'],        image: 'https://cdn.shopify.com/s/files/1/0580/2865/4785/products/PRIME-Evolution-Tricep-Extension-Web.jpg?v=1635874917' },
  ].map(it => ({ brand: 'Prime', line: 'Evolution', kind: 'machine', ...it })),
});
