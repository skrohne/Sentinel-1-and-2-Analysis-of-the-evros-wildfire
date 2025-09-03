//Load AOI into script
var aoi = table; 

//Define dates for preFire and postFire
var preFireStart = '2023-08-01';
var preFireEnd = '2023-08-20';
var postFireStart = '2023-09-01';
var postFireEnd = '2023-09-20';

// Water Mask
var gsw = ee.Image('JRC/GSW1_0/GlobalSurfaceWater');
var occurrence = gsw.select('occurrence');
var permanentWater = occurrence.gt(50).unmask(0);
var landMask = permanentWater.not();

// Lee Filter
function leeFilter(image, kernelSize) {
  var bandNames = image.bandNames().remove('angle');
  var enl = 5;
  var eta = ee.Image.constant(1.0 / Math.sqrt(enl));
  var oneImg = ee.Image.constant(1);

  var reducers = ee.Reducer.mean().combine({
    reducer2: ee.Reducer.variance(),
    sharedInputs: true
  });

  var stats = image.select(bandNames).reduceNeighborhood({
    reducer: reducers,
    kernel: ee.Kernel.square(kernelSize / 2, 'pixels'),
    optimization: 'window'
  });

  var meanBand = bandNames.map(function(b) { return ee.String(b).cat('_mean'); });
  var varBand = bandNames.map(function(b) { return ee.String(b).cat('_variance'); });

  var z_bar = stats.select(meanBand);
  var varz = stats.select(varBand);

  var varx = (varz.subtract(z_bar.pow(2).multiply(eta.pow(2)))).divide(oneImg.add(eta.pow(2)));
  var b = varx.divide(varz).where(varz.eq(0), 0);
  var new_b = b.where(b.lt(0), 0);

  var output = oneImg.subtract(new_b).multiply(z_bar.abs()).add(new_b.multiply(image.select(bandNames)));
  output = output.rename(bandNames);
  return image.addBands(output, null, true);
}

// Calculation of Gamma0 with and without lee filter
function prepareS1(image) {
  //select VV, VH
  var vv = image.select('VV');
  var vh = image.select('VH');
  var angleRad = image.select('angle').multiply(Math.PI / 180);

  //Calculate Gamma0 
  var vvGamma = vv.divide(angleRad.cos()).rename('VV_gamma0');
  var vhGamma = vh.divide(angleRad.cos()).rename('VH_gamma0');
 
 // Lee-Filter on original bands
  var lee = leeFilter(image.select(['VV', 'VH']), 3);
  var vvLee = lee.select('VV').rename('VV_lee');
  var vhLee = lee.select('VH').rename('VH_lee');
  
  // Lee-Filter on Gamma0-bands
  var gammaImage = ee.Image.cat([vvGamma, vhGamma]);
  var gammaLee = leeFilter(gammaImage, 3);
  var vvGammaLee = gammaLee.select('VV_gamma0').rename('VV_gamma0_lee');
  var vhGammaLee = gammaLee.select('VH_gamma0').rename('VH_gamma0_lee');

  //add into Collection
  return image
    .addBands([vvGamma, vhGamma, vvLee, vhLee, vvGammaLee, vhGammaLee]);
}

// Load Sentinel-1 ImageCollection and filter
var sentinel1Pre = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterDate(preFireStart, preFireEnd)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
  .map(prepareS1); 
  
var sentinel1Post = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterDate(postFireStart, postFireEnd)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
  .map(prepareS1); 


//create composites
var preMedian = sentinel1Pre.median().updateMask(landMask).clip(aoi);
var postMedian = sentinel1Post.median().updateMask(landMask).clip(aoi);

//Export to Asset 
Export.image.toAsset({
  image: preMedian,
  description: 'Sentinel1_Composite_Pre_Fire',
  assetId: 'S1_Composite_Pre_Fire',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toAsset({
  image: postMedian,
  description: 'Sentinel1_Composite_Post_Fire',
  assetId: 'S1_Composite_Post_Fire',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});
