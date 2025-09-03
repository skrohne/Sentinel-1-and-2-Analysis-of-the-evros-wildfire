// Load your AOI
var aoi = table; 

// Load your composites
var compositePre  = image; 
var compositePost = image2; 

// Function to calculate NBR
function computeNBR(image) {
  return image
    .normalizedDifference(['B8', 'B12']) // NBR = (NIR - SWIR2) / (NIR + SWIR2)
}
// Calculate NBR for pre-fire and post-fire
var preNBR = computeNBR(compositePre);
var postNBR = computeNBR(compositePost);

// Calculation of dNBR
var dNBR_unscaled = preNBR.subtract(postNBR);
// Scale product to USGS standards
var dNBR = dNBR_unscaled.multiply(1000);


//------------------------- Burn Ratio Product - Classification ----------------------------

// Define an SLD style of discrete intervals to apply to the image.
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


// Seperate result into 8 burn severity classes
var thresholds = ee.Image([-1000, -251, -101, 99, 269, 439, 659, 2000]);
var classified = dNBR.lt(thresholds).reduce('sum').toInt();

//==========================================================================================
//                              ADD BURNED AREA STATISTICS

// count number of pixels in entire layer
var allpix =  classified.updateMask(classified);  // mask the entire layer
var pixstats = allpix.reduceRegion({
  reducer: ee.Reducer.count(),               // count pixels in a single class
  geometry: aoi,
  scale: 10,                     //10 meter per pixel for Sentinel 2
  maxPixels: 1e8 

  });
var allpixels = ee.Number(pixstats.get('sum')); // extract pixel count as a number


// create an empty list to store area values in
var arealist = [];

// create a function to derive extent of one burn severity class
// arguments are class number and class name
var areacount = function(cnr, name) {
 var singleMask =  classified.updateMask(classified.eq(cnr));  // mask a single class
 var stats = singleMask.reduceRegion({
  reducer: ee.Reducer.count(),               // count pixels in a single class
  geometry: aoi,
  scale: 10,                         //10 meter per pixel for Sentinel 2
  maxPixels: 1e8 
  });
var pix =  ee.Number(stats.get('sum'));
var hect = pix.multiply(100).divide(10000);                // Landsat pixel = 30m x 30m --> 900 sqm
var perc = pix.divide(allpixels).multiply(10000).round().divide(100);   // get area percent by class and round to 2 decimals
arealist.push({Class: name, Pixels: pix, Hectares: hect, Percentage: perc});
};

// severity classes in different order
var names2 = ['NA', 'High Severity', 'Moderate-high Severity',
'Moderate-low Severity', 'Low Severity','Unburned', 'Enhanced Regrowth, Low', 'Enhanced Regrowth, High'];

// execute function for each class
for (var i = 0; i < 8; i++) {
  areacount(i, names2[i]);
  }

print('Burned Area by Severity Class', arealist);


//==========================================================================================
//                                    VISUALIZE

// Visualization parameters for NBR
var nbrViz = {
  min: -1,
  max: 1,
  palette: ['black', 'red', 'orange', 'yellow', 'green', 'white']
};

// Add pre-fire NBR to map
Map.addLayer(preNBR, nbrViz, 'Pre-fire NBR');

// Add post-fire NBR to map
Map.addLayer(postNBR, nbrViz, 'Post-fire NBR');

// Calculate greyscale dNBR and add to map
var grey = ['white', 'black'];
Map.addLayer(dNBR.clip(aoi), {min: -1000, max: 1000, palette: grey}, 'dNBR greyscale');

// Add the classified image to the map using both the color ramp and interval schemes.
var dNBR_final = dNBR.clip(aoi).sldStyle(sld_intervals)
Map.addLayer(dNBR_final, {}, 'dNBR classified');


//==========================================================================================
//                                    ADD A LEGEND

// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }});
 
// Create legend title
var legendTitle = ui.Label({
  value: 'dNBR Classes',
  style: {fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }});
 
// Add the title to the panel
legend.add(legendTitle);
 
// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
 
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }});
 
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      })};
 
//  Palette with the colors
var palette =['7a8737', 'acbe4d', '0ae042', 'fff70b', 'ffaf38', 'ff641b', 'a41fd6', 'ffffff'];
 
// name of the legend
var names = ['Enhanced Regrowth, High','Enhanced Regrowth, Low','Unburned', 'Low Severity',
'Moderate-low Severity', 'Moderate-high Severity', 'High Severity', 'NA'];
 
// Add color and and names
for (var i = 0; i < 8; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
 
// add legend to map 
Map.add(legend)

/*
// === Export image and table to Drive ===
Export.image.toDrive({
  image: dNBR_final,
  description: 'Burn_Severity_dNBR',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});
*/
