// Load your AOI
var aoi = table;

//Trainingsdata Pre
var siedlung = Siedlung;
var vegetationPre = VegetationPre;
var ackerPre = AckerPre;

//Trainingsdata Post
var vegetationPost = VegetationPost; 
var ackerPost = AckerPost; 
var burn = Burn; 

// Mergen:
var trainingPointsPre = siedlung.merge(vegetationPre).merge(ackerPre);
var trainingPointsPost = siedlung.merge(vegetationPost).merge(ackerPost).merge(burn); 

// Load your Composites
var preMedian = image; 
var postMedian = image2; 

// === Functions for Index Calculation ===

// RBD (Radar Burn Difference)
function calculateRBD(post, pre, band) {
  return post.select(band).subtract(pre.select(band)).rename('RBD_' + band.split('_')[0]);
}
// RBR (Radar Burn Ratio)
function calculateRBR(post, pre, band) {
  return post.select(band).divide(pre.select(band)).rename('RBR_' + band.split('_')[0]);
}
// RVI (Radar Vegetation Index)
function calculateRVI(image, vvBand, vhBand) {
  return image.select(vhBand).multiply(4)
    .divide(image.select(vvBand).add(image.select(vhBand)))
    .rename('RVI');
}
// DPSVI (Dual Polarization SAR Vegetation Index)
function calculateDPSVI(image, vvBand, vhBand) {
  return image.select(vvBand).add(image.select(vhBand))
    .divide(image.select(vvBand))
    .rename('DPSVI');
}
// Calculate the Texture
function calculateVVTexture(image, vvBand) {
  return image.select(vvBand)
    .reduceNeighborhood({
      reducer: ee.Reducer.stdDev(),
      kernel: ee.Kernel.square(3)
    }).rename('VV_stdDev');
}
// calculate the difference
function calculateDifference(postIndex, preIndex, name) {
  return postIndex.subtract(preIndex).rename('diff_' + name);
}
// Define bands 
var vvBand = 'VV_gamma0_lee';
var vhBand = 'VH_gamma0_lee';

// RBD & RBR
var rbdVV = calculateRBD(postMedian, preMedian, vvBand);
var rbdVH = calculateRBD(postMedian, preMedian, vhBand);
var rbrVV = calculateRBR(postMedian, preMedian, vvBand);
var rbrVH = calculateRBR(postMedian, preMedian, vhBand);

// RVI & DPSVI
var preRVI = calculateRVI(preMedian, vvBand, vhBand);
var postRVI = calculateRVI(postMedian, vvBand, vhBand);
var diffRVI = calculateDifference(postRVI, preRVI, 'RVI');

var preDPSVI = calculateDPSVI(preMedian, vvBand, vhBand);
var postDPSVI = calculateDPSVI(postMedian, vvBand, vhBand);
var diffDPSVI = calculateDifference(postDPSVI, preDPSVI, 'DPSVI');

// Texture
var preVVTexture = calculateVVTexture(preMedian, vvBand);
var postVVTexture = calculateVVTexture(postMedian, vvBand);



// Feature Stack Pre
var featureStackPre = preMedian
  .select([
    'VV_lee', 'VH_lee',
    'VV_gamma0_lee', 'VH_gamma0_lee'
  ])
  .addBands(preRVI.rename('RVI'))
  .addBands(preDPSVI.rename('DPSVI'))
  .addBands(preVVTexture.rename('Texture_VV'));
  
// Feature Stack post
var featureStackPost = postMedian
  .select([
    'VV_lee', 'VH_lee',
    'VV_gamma0_lee', 'VH_gamma0_lee'
  ])
  .addBands(rbdVV.rename('RBD_VV'))
  .addBands(rbdVH.rename('RBD_VH'))
  .addBands(rbrVV.rename('RBR_VV'))
  .addBands(rbrVH.rename('RBR_VH'))
  .addBands(diffRVI.rename('diffRVI'))
  .addBands(diffDPSVI.rename('diffDPSVI'))
  .addBands(postRVI.rename('RVI'))
  .addBands(postDPSVI.rename('DPSVI'))
  .addBands(postVVTexture.rename('Texture_VV'))




// === Classification ===

function trainClassifier(image, trainingData, classProperty, numTrees) {
var training = image.sampleRegions({
 collection: trainingData,
 properties: [classProperty],
 scale: 10,
});

 var classifier = ee.Classifier.smileRandomForest(numTrees)
.train({
 features: training,
 classProperty: classProperty
 });

 return classifier;
 }

function classifyImage(image, classifier, validationData, classProperty) {
var classified = image.classify(classifier);
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
 return {
 classified: classified,
 errorMatrix: errorMatrix
 };
 }

function getFeatureImportance(classifier) {
  var explanation = classifier.explain();
  var importances = ee.Dictionary(explanation.get('importance'));
  var total = importances.values().reduce(ee.Reducer.sum());
  return importances.map(function(key, value) {
    return ee.Number(value).divide(total).multiply(100);
  });
}

function runClassificationWorkflow(image, points, label, numTrees, labelText) {
  
  // Split Training/Validation
  var withRandom = points.randomColumn('random');
  var training = withRandom.filter(ee.Filter.lt('random', 0.7));
  var validation = withRandom.filter(ee.Filter.gte('random', 0.7));
  
  // Train
  var classifier = trainClassifier(image, training, label, numTrees);
  
  // Classify & Validate
  var result = classifyImage(image, classifier, validation, label);
  
  // Accuracy Metrics
  print('Error Matrix ' + labelText + ':', result.errorMatrix);
  print('Overall Accuracy ' + labelText + ':', result.errorMatrix.accuracy());
  print('Kappa Index ' + labelText + ':', result.errorMatrix.kappa());
  print('Producers Accuracy ' + labelText + ':', result.errorMatrix.producersAccuracy()); 
  print('Users Accuracy ' + labelText + ':', result.errorMatrix.consumersAccuracy());
  print('Klassifikation ' + labelText + ':', result.classified);
  
  // Feature Importance
  var importancesPercent = getFeatureImportance(classifier);
  print('Feature Importance in % (' + labelText + ')', importancesPercent);
  
  // Visualisation
  Map.addLayer(result.classified, {min: 0, max: 3, palette:['red', 'green', 'blue', 'yellow']}, 'RF Classification ' + labelText);

  return result; 
}

// Parameter
var numTrees = 100;
var classProperty = 'class';

// Klassifikation Pre & Post
var resultsPost = runClassificationWorkflow(featureStackPost, trainingPointsPost, classProperty, numTrees, 'Post');
var resultsPre  = runClassificationWorkflow(featureStackPre, trainingPointsPre, classProperty, numTrees, 'Pre');
