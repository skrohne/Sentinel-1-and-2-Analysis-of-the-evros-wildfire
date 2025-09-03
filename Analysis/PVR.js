var aoi       = geometry; 
var forestAOI = geometry2; 
var agrarAOI  = geometry3; 

var compositePre    = image; 
var compositePost   = image2; 
var compositeSommer = image3; 

function getThreeComposites(region) {
  return {
    pre: compositePre.clip(region),
    post: compositePost.clip(region),
    summer: compositeSommer.clip(region)
  };
}

var forestImages = getThreeComposites(forestAOI);
var agrarImages  = getThreeComposites(agrarAOI);




// Visualization parameters
var visParams = { min: 0.0, max: 0.3, bands: ['B4', 'B3', 'B2'] };

Map.addLayer(forestImages.summer, visParams, 'Forest Summer');
Map.addLayer(forestImages.pre, visParams, 'Forest Pre-Fire');
Map.addLayer(forestImages.post, visParams, 'Forest Post-Fire');
Map.addLayer(agrarImages.summer, visParams, 'Agrar Summer');
Map.addLayer(agrarImages.pre, visParams, 'Agrar Pre-Fire');
Map.addLayer(agrarImages.post, visParams, 'Agrar Post-Fire');

// === NDVI / NBR / dNBR functions ===
function calculateNDVI(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
}

// Calculate NBR
function calculateNBR(image) {
  return image.normalizedDifference(['B8', 'B12']).rename('NBR');
}

// Calculate dNBR from two images
function calculateDNBR(pre, post) {
  var nbrPre = calculateNBR(pre);
  var nbrPost = calculateNBR(post);
  return nbrPre.subtract(nbrPost).multiply(1000).rename('dNBR');
}

// Step classification (for dNBR)
function getClassStatsStep(image, aoi, classNames, thresholds, scale) {
  var classified = image.lt(ee.Image.constant(thresholds)).reduce('sum').toInt();

  var pixstats = classified.reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e13
  });
  var allpixels = ee.Number(pixstats.get('sum'));

  var arealist = [];
  for (var i = 0; i < classNames.length; i++) {
    var singleMask = classified.updateMask(classified.eq(i));
    var stats = singleMask.reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: aoi,
      scale: scale,
      maxPixels: 1e13
    });
    var pix = ee.Number(stats.get('sum'));
    var hect = pix.multiply(scale * scale).divide(10000);
    var perc = pix.divide(allpixels).multiply(10000).round().divide(100);
    arealist.push({Class: classNames[i], Pixels: pix, Hectares: hect, Percentage: perc});
  }
  return arealist;
}

// Range classification (for NDVI)
function getClassStatsRange(ndvi, aoi, classNames, thresholds, scale) {
  var classified = ee.Image(0)
    .where(ndvi.gte(thresholds[0]).and(ndvi.lt(thresholds[1])), 1)
    .where(ndvi.gte(thresholds[1]).and(ndvi.lt(thresholds[2])), 2)
    .where(ndvi.gte(thresholds[2]), 3)
    .rename('NDVI_class');

  var stats = classified.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e13
  }).get('NDVI_class');

  stats = ee.Dictionary(stats);
  var allpixels = stats.values().reduce(ee.Reducer.sum());

  return classNames.map(function(name, i) {
    var key = ee.String(ee.Number(i).format());   // fix: ensure string key
    var pix = ee.Number(stats.get(key, 0));
    var hect = pix.multiply(scale * scale).divide(10000);
    var perc = pix.divide(allpixels).multiply(10000).round().divide(100);
    return {Class: name, Pixels: pix, Hectares: hect, Percentage: perc};
  });
}


// NDVI Analysis
function analyzeNDVI(img, label, aoi) {
  var ndvi = calculateNDVI(img); 
  
  var thresholds = [0.1, 0.4, 0.6];
  var classNames = ['Non-Vegetation', 'Sparse Vegetation', 'Moderate Vegetation', 'Dense Vegetation'];
  var stats = getClassStatsRange(ndvi, aoi, classNames, thresholds, 10);
  
  print(label + ' NDVI Statistik', stats);
  
  Map.addLayer(ndvi.clip(aoi), 
    {min: -1, max: 1, palette: ['red', 'blue','lightgreen','darkgreen']}, 
    label + ' NDVI');
}

// dNBR Analysis

function analyzeNBR(img, label, aoi) {
  var dNBR = calculateDNBR(img.pre, img.post);

  var thresholds = [-1000, -251, -101, 99, 269, 439, 659, 2000];
  var classNames = [
    'NA',
    'High Severity',
    'Moderate-high Severity',
    'Moderate-low Severity',
    'Low Severity',
    'Unburned',
    'Enhanced Regrowth, Low',
    'Enhanced Regrowth, High'
  ];

  var stats = getClassStatsStep(dNBR, aoi, classNames, thresholds, 10); 
  print(label + ' dNBR Statistik', stats);


  var sld_intervals =
    '<RasterSymbolizer>' +
      '<ColorMap type="intervals" extended="false" >' +
        '<ColorMapEntry color="#ffffff" quantity="-500" label="-500"/>' +
        '<ColorMapEntry color="#7a8737" quantity="-250" label="-250" />' +
        '<ColorMapEntry color="#acbe4d" quantity="-100" label="-100" />' +
        '<ColorMapEntry color="#0ae042" quantity="100" label="100" />' +
        '<ColorMapEntry color="#fff70b" quantity="270" label="270" />' +
        '<ColorMapEntry color="#ffaf38" quantity="440" label="440" />' +
        '<ColorMapEntry color="#ff641b" quantity="660" label="660" />' +
        '<ColorMapEntry color="#a41fd6" quantity="2000" label="2000" />' +
      '</ColorMap>' +
    '</RasterSymbolizer>';

  Map.addLayer(dNBR.clip(aoi).sldStyle(sld_intervals), {}, label + ' dNBR classified');
}

// NDVI Wrapper
function callNDVI(images, aoi, label) {
  var periods = [
    {img: images.pre,   name: 'Pre'},
    {img: images.post,  name: 'Post'},
    {img: images.summer,name: 'Summer'}
  ];

  periods.forEach(function(p) {
    analyzeNDVI(p.img, label + ' ' + p.name, aoi);
  });
}

// NBR Wrapper
function callNBR(images, aoi, label) {
  var pairs = [
    {pre: images.pre, post: images.post,   name: 'Pre-Post'},
    {pre: images.pre, post: images.summer, name: 'Pre-Summer'}
  ];

  pairs.forEach(function(p) {
    var dNBR = {pre: p.pre, post: p.post}; 
    analyzeNBR(dNBR, label + ' ' + p.name, aoi);
  });
}


// Run
callNDVI(forestImages, forestAOI, 'Forest');
callNDVI(agrarImages, agrarAOI, 'Agrar');

callNBR(forestImages, forestAOI, 'Forest');
callNBR(agrarImages, agrarAOI, 'Agrar');
