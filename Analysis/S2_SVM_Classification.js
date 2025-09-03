//Load your AOI
var aoi = table; 

//Trainingsdaten: 
var unburned = Unburned; 
var burned = Burned; 

// Mergen:
var trainingPointsPost = unburned.merge(burned);

// Inputdata
var compositePre = image;
var compositePost = image2;

// === Preparing Sentinel 2 data  ===

//Calculate NDVI
function calculateNDVI(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
}
//Calculate SAVI
function calculateSAVI(image) {
  return image.expression(
    '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
      'NIR': image.select('B8'),
      'RED': image.select('B4'),
      'L': 0.5
    }).rename('SAVI');
}
//Calculate EVI
function calculateEVI(image) {
  return image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': image.select('B8'),
      'RED': image.select('B4'),
      'BLUE': image.select('B2')
    }).rename('EVI');
}
//Calculate MIRBI
function calculateMIRBI(image) {
  return image.expression(
    '10 * SWIR1 - 9.8 * SWIR2 + 2', {
      'SWIR1': image.select('B11'),
      'SWIR2': image.select('B12')
    }).rename('MIRBI');
}
//Calculate BAI
function calculateBAI(image) {
  return image.expression(
    '1 / ((0.1 - NIR)**2 + (0.06 - RED)**2)', {
      'NIR': image.select('B8'),
      'RED': image.select('B4')
    }).rename('BAI');
}
//Calculate BAIS2
function calculateBAIS2(image) {
  return image.expression(
    '(1 - sqrt((B6 * B7 * B8A) / B4)) * ((B12 - B8A) / sqrt(B12 + B8A) + 1)', {
      'B4': image.select('B4'),
      'B6': image.select('B6'),
      'B7': image.select('B7'),
      'B8A': image.select('B8A'),
      'B12': image.select('B12')
    }).rename('BAIS2');
}
//Calculate NBR
function calculateNBR(image) {
  return image.normalizedDifference(['B8', 'B12']).rename('NBR');
}

//Function to get pre, post, and delta indices
function getIndexTriplet(calcFunc, preImage, postImage, indexName) {
  var pre = calcFunc(preImage);
  var post = calcFunc(postImage);
  var delta = post.subtract(pre).rename('d' + indexName);
  return {pre: pre, post: post, delta: delta};
}
// Generate all indices
var NDVI = getIndexTriplet(calculateNDVI, compositePre, compositePost, 'NDVI');
var SAVI = getIndexTriplet(calculateSAVI, compositePre, compositePost, 'SAVI');
var EVI = getIndexTriplet(calculateEVI, compositePre, compositePost, 'EVI');
var MIRBI = getIndexTriplet(calculateMIRBI, compositePre, compositePost, 'MIRBI');
var BAI = getIndexTriplet(calculateBAI, compositePre, compositePost, 'BAI');
var BAIS2 = getIndexTriplet(calculateBAIS2, compositePre, compositePost, 'BAIS2');
var NBR = getIndexTriplet(calculateNBR, compositePre, compositePost, 'NBR');

//Build Feature Stack Post
var featureStackPost = compositePost.select([
    'B2','B3', 'B4', 'B5', 'B6', 'B7', 'B8A', 'B11', 'B12'
  ])
  //.addBands(NDVI.delta.rename('NDVI'))
  .addBands(EVI.delta.rename('EVI'))
  //.addBands(SAVI.delta.rename('SAVI'))
  .addBands(MIRBI.delta.rename('MIRBI'))
  //.addBands(BAI.delta.rename('BAI'))
  .addBands(BAIS2.delta.rename('BAIS2'))
  .addBands(NBR.delta.rename('NBR'));
// === Check:
print('FeatureStackPost:', featureStackPost);

// === Classification ===

// SVM Parameter
var classProperty = 'class';  // your label
var svmKernel = 'RBF';  
var svmCost = 10; 
var svmGamma = 0.1;  

// Split into training / validation (z.B. 70/30 Split)
var withRandom = trainingPointsPost.randomColumn('random');
var trainingData = withRandom.filter(ee.Filter.lt('random', 0.7));
var validationData = withRandom.filter(ee.Filter.gte('random', 0.7));

// Prepare training samples
var training = featureStackPost.sampleRegions({
  collection: trainingData,
  properties: [classProperty],
  scale: 10
});

// Train SVM
var svmClassifier = ee.Classifier.libsvm({
  kernelType: svmKernel,
  cost: svmCost,
  gamma: svmGamma
}).train({
  features: training,
  classProperty: classProperty,
  inputProperties: featureStackPost.bandNames()
});

// Classify the image
var classified = featureStackPost.classify(svmClassifier);

// Validate
var validation = classified.sampleRegions({
  collection: validationData,
  properties: [classProperty],
  scale: 10,
  tileScale: 8
});

var errorMatrix = validation.errorMatrix({
  actual: classProperty,
  predicted: 'classification'
});

// Visualization
Map.addLayer(classified, {min: 0, max: 1, palette: ['green', 'red']}, 'SVM Classification POST');

// Print results
print('Error Matrix POST (SVM):', errorMatrix);
print('Overall Accuracy POST (SVM):', errorMatrix.accuracy());
print('Klassifikation POST (SVM):', classified);
print('Kappa Index :', errorMatrix.kappa());
print('Producers Accuracy:', errorMatrix.producersAccuracy()); 
print('Users Accuracy:', errorMatrix.consumersAccuracy());
