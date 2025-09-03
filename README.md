# Analysis of Sentinel-1 and Sentinel-2 data for the detection of wildfire affected vegetation areas: a case study of the Evros Wildfire (2023)

## Repository Contents

This repository contains the code developed for my bachelor thesis on the use of **Sentinel-1 and Sentinel-2 data** for analyzing wildfire-affected vegetation areas.  
The workflows were implemented in **Google Earth Engine (GEE)** and cover the following components:

### 1. Burned Area Mapping
- Random Forest classification using Sentinel-1 data, Sentinel-2 data, and their combination  
- Support Vector Machine (SVM) classification using Sentinel-2 data  
- Integration of radar- and spectral-based indices to improve classification accuracy
- **S1_RF_Classification.js**
- **S2_RF_Classification.js**
- **S2_SVM_Classification.js**
- **Kombi_RF_Classification.js**


### 2. Burn Severity Assessment
- Threshold-based classification using the **differenced Normalized Burn Ratio (dNBR)**
- **burnSeverityNBR.js**

### 3. Post-Fire Vegetation Recovery (PVR)
- Threshold-based classification using **dNBR** and **NDVI**  
- Analysis conducted in two selected test areas
- **PVR.js**

### 4. Workflow Implementation
- Semi-automated scripts in Google Earth Engine for preprocessing, classification, and evaluation  

### 5. Preprocessing Scripts
The repository also includes **PreProcessingS1.js and PreProcessingS2.js files** with preprocessing routines for Sentinel-1 and Sentinel-2 data, designed to be run in Google Earth Engine.  
