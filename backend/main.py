# backend/main.py

import os
import uuid
import json
import datetime
import glob
from typing import List

import numpy as np
import nibabel as nib
import pydicom
import matplotlib.pyplot as plt
from PIL import Image
import io

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse # FileResponse might be useful for other things, keeping it for now
from fastapi.middleware.cors import CORSMiddleware
from pydicom.dataset import FileMetaDataset
from pydicom.uid import generate_uid

from highdicom.seg import Segmentation
from highdicom.seg.content import SegmentDescription
from pydicom.sr.coding import Code
from highdicom import PixelMeasuresSequence
from highdicom import PlanePositionSequence
from highdicom import PlaneOrientationSequence
from pydicom.dataset import Dataset
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
    expose_headers=["Content-Length", "Content-Range", "Content-Type"],
)

# --- CORRECTED ORDER ---
# 1. Define the constant for the upload directory first.
UPLOAD_ROOT = "uploads"

# 2. Create the directory.
os.makedirs(UPLOAD_ROOT, exist_ok=True)

# 3. Now that UPLOAD_ROOT is defined, you can safely use it to mount the static directory.
# This mount will serve everything inside UPLOAD_ROOT, including the new 'previews' folders.
app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")
# -----------------------


label_dict = {
    1: "Lower Jawbone", 2: "UpperAC Jawbone", 3: "Left Inferior Alveolar Canal",
    4: "Right Inferior Alveolar Canal", 5: "Left Maxillary Sinus", 6: "Right Maxillary Sinus",
    7: "Pharynx", 8: "Bridge", 9: "Crown", 10: "Implant", 11: "Upper Right Central Incisor",
    12: "Upper Right Lateral Incisor", 13: "Upper Right Canine", 14: "Upper Right First Premolar",
    15: "Upper Right Second Premolar", 16: "Upper Right First Molar", 17: "Upper Right Second Molar",
    18: "Upper Right Third Molar (Wisdom Tooth)", 19: "NA", 20: "NA1",
    21: "Upper Left Central Incisor", 22: "Upper Left Lateral Incisor", 23: "Upper Left Canine",
    24: "Upper Left First Premolar", 25: "Upper Left Second Premolar", 26: "Upper Left First Molar",
    27: "Upper Left Second Molar", 28: "Upper Left Third Molar (Wisdom Tooth)", 29: "NA2",
    30: "NA3", 31: "Lower Left Central Incisor", 32: "Lower Left Lateral Incisor", 33: "Lower Left Canine",
    34: "Lower Left First Premolar", 35: "Lower Left Second Premolar", 36: "Lower Left First Molar",
    37: "Lower Left Second Molar", 38: "Lower Left Third Molar (Wisdom Tooth)", 39: "NA4",
    40: "NA5", 41: "Lower Right Central Incisor", 42: "Lower Right Lateral Incisor",
    43: "Lower Right Canine", 44: "Lower Right First Premolar", 45: "Lower Right Second Premolar",
    46: "Lower Right First Molar", 47: "Lower Right Second Molar", 48: "Lower Right Third Molar (Wisdom Tooth)"
}

def convert_nifti_to_dicom_and_seg(study_id: str, radiography_type: str):
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    image_path = os.path.join(study_path, "image.nii.gz")
    mask_path = os.path.join(study_path, "mask.nii.gz")
    dicom_series_path = os.path.join(study_path, "dicom_series")
    segmentation_path = os.path.join(study_path, "segmentation")

    os.makedirs(dicom_series_path, exist_ok=True)
    os.makedirs(segmentation_path, exist_ok=True)

    # --- DICOM UID and Date/Time Setup ---
    study_instance_uid = generate_uid()
    series_instance_uid = generate_uid()
    seg_series_instance_uid = generate_uid()
    frame_of_reference_uid = generate_uid()
    now = datetime.datetime.utcnow()
    study_date = now.strftime("%Y%m%d")
    study_time = now.strftime("%H%M%S.%f")

    # --- NIfTI to DICOM Image Series Conversion ---
    nifti_img = nib.load(image_path)
    image_array = nifti_img.get_fdata().astype(np.int16)
    zooms = nifti_img.header.get_zooms()
    
    image_orientation = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
    
    rows, cols, num_slices = image_array.shape
    pixel_spacing_x, pixel_spacing_y, slice_thickness = zooms
    start_position = [-pixel_spacing_x * cols / 2, -pixel_spacing_y * rows / 2, 0]
    
    dicom_slice_paths = []
    source_dicom_datasets = []

    for i in range(image_array.shape[2]):
        slice_2d = image_array[:, :, i]
        ds = pydicom.Dataset()
        ds.PatientName = "Anonymous^Patient"
        ds.PatientID = "PID-001"
        ds.PatientBirthDate = "19700101"
        ds.PatientSex = "O"
        ds.AccessionNumber = "000000"
        ds.StudyID = "1"
        ds.StudyInstanceUID = study_instance_uid
        ds.SeriesInstanceUID = series_instance_uid
        ds.FrameOfReferenceUID = frame_of_reference_uid
        ds.SOPInstanceUID = generate_uid()
        ds.SOPClassUID = pydicom.uid.CTImageStorage
        ds.Modality = "CT"
        ds.SeriesNumber = 1
        ds.InstanceNumber = i + 1
        ds.StudyDate = study_date
        ds.StudyTime = study_time
        
        ds.ImageOrientationPatient = image_orientation
        
        current_position = start_position.copy()
        current_position[2] += i * slice_thickness
        ds.ImagePositionPatient = [float(p) for p in current_position]
        
        ds.PixelSpacing = [float(zooms[0]), float(zooms[1])]
        ds.SliceThickness = float(zooms[2])
        ds.SpacingBetweenSlices = float(zooms[2])
        
        ds.Rows, ds.Columns = slice_2d.shape
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.SamplesPerPixel = 1
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 1
        ds.PixelData = slice_2d.tobytes()
        
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
        file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
        file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
        ds.file_meta = file_meta
        
        slice_filepath = os.path.join(dicom_series_path, f"slice_{i:03d}.dcm")
        ds.save_as(slice_filepath, write_like_original=False)
        dicom_slice_paths.append(slice_filepath)
        source_dicom_datasets.append(ds) # Append the dataset directly

    # --- Mask Preparation ---
    mask_img = nib.load(mask_path)
    mask_array = mask_img.get_fdata().astype(np.uint8)
    
    if mask_array.shape != image_array.shape:
        raise ValueError(f"Mask shape {mask_array.shape} does not match image shape {image_array.shape}")
    if not np.allclose(mask_img.affine, nifti_img.affine):
        print("Warning: Mask and image have different affine transformations.")

    valid_labels = [k for k, v in label_dict.items() if not v.startswith("NA")]
    mask_array[~np.isin(mask_array, valid_labels)] = 0
    present_labels = sorted([label for label in np.unique(mask_array) if label != 0])
    if not present_labels:
        raise ValueError("No valid segments found in mask after filtering.")
    
    segment_descriptions = []
    available_classes = []
    remapped_mask_array = np.zeros_like(mask_array, dtype=np.uint8)
    for i, original_label in enumerate(present_labels):
        segment_number = i + 1
        label_name = label_dict.get(original_label, f"Unknown_{original_label}")
        remapped_mask_array[mask_array == original_label] = segment_number
        segment_descriptions.append(
            SegmentDescription(
                segment_number=segment_number,
                segment_label=label_name,
                segmented_property_category=Code("T-D0050", "SRT", "Anatomical Structure"),
                segmented_property_type=Code(str(original_label), "SCT", label_name),
                algorithm_type="MANUAL"
            )
        )
        available_classes.append({"label": label_name, "value": int(original_label)})
    
    remapped_mask_array = np.transpose(remapped_mask_array, (2, 0, 1))

    # --- DICOM-SEG Creation ---
    seg_dataset = Segmentation(
        source_images=source_dicom_datasets,
        pixel_array=remapped_mask_array,
        segmentation_type="BINARY",
        segment_descriptions=segment_descriptions,
        series_instance_uid=seg_series_instance_uid,
        series_number=2,
        sop_instance_uid=generate_uid(),
        instance_number=1,
        manufacturer="MyLab Inc.",
        manufacturer_model_name="NIfTI-to-SEG Converter",
        software_versions="1.0",
        device_serial_number="12345"
    )

    seg_filepath = os.path.join(segmentation_path, "seg.dcm")
    seg_dataset.save_as(seg_filepath)

    # --- NEW: Pre-generate PNG Previews ---
    preview_path = os.path.join(study_path, "previews")
    os.makedirs(preview_path, exist_ok=True)
    
    # Use the source_dicom_datasets we already have in memory
    for i, ds in enumerate(source_dicom_datasets):
        pixel_array = ds.pixel_array
        
        # Fast normalization
        min_val, max_val = pixel_array.min(), pixel_array.max()
        if max_val > min_val:
            normalized = np.uint8(255 * ((pixel_array - min_val) / (max_val - min_val)))
        else:
            normalized = np.zeros(pixel_array.shape, dtype=np.uint8)
            
        img = Image.fromarray(normalized)
        # Save the PNG directly to the previews folder
        img.save(os.path.join(preview_path, f"slice_{i:03d}.png"), 'PNG', optimize=True)


    # --- Metadata for Frontend ---
    metadata = {
        "StudyInstanceUID": study_instance_uid,
        "StudyDate": study_date,
        "RadiographyType": radiography_type,
        "AvailableClasses": available_classes,
        "PatientID": "PID-001"
    }
    with open(os.path.join(study_path, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=4)

    return {
        "study_id": study_id,
        "metadata": metadata
    }

@app.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    image_file: UploadFile = File(..., description="NIfTI image file (.nii.gz)"),
    mask_file: UploadFile = File(..., description="NIfTI segmentation mask file (.nii.gz)"),
    radiography_type: str = Form(...)
):
    if not (image_file.filename.endswith(".nii.gz") or image_file.filename.endswith(".nii")):
        raise HTTPException(status_code=400, detail="Image file must be .nii or .nii.gz")
    if not (mask_file.filename.endswith(".nii.gz") or mask_file.filename.endswith(".nii")):
        raise HTTPException(status_code=400, detail="Mask file must be .nii or .nii.gz")

    study_id = str(uuid.uuid4())
    study_folder = os.path.join(UPLOAD_ROOT, study_id)
    os.makedirs(study_folder, exist_ok=True)

    image_path = os.path.join(study_folder, "image.nii.gz")
    mask_path = os.path.join(study_folder, "mask.nii.gz")

    with open(image_path, "wb") as f:
        content = await image_file.read()
        f.write(content)
    with open(mask_path, "wb") as f:
        content = await mask_file.read()
        f.write(content)

    # Add the conversion task to background
    background_tasks.add_task(convert_nifti_to_dicom_and_seg, study_id, radiography_type)

    # Return immediately with 202 Accepted status
    return JSONResponse(
        status_code=202,
        content={
            "study_id": study_id,
            "message": "Processing started."
        }
    )

# Add new status endpoint
@app.get("/studies/{study_id}/status")
async def get_study_status(study_id: str):
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    metadata_path = os.path.join(study_path, "metadata.json")

    if not os.path.isdir(study_path):
        raise HTTPException(status_code=404, detail="Study not found")

    if os.path.isfile(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        return {
            "status": "complete",
            "metadata": metadata
        }
    else:
        return {"status": "processing"}

@app.get("/studies")
def get_studies():
    studies = []
    for study_id in os.listdir(UPLOAD_ROOT):
        study_path = os.path.join(UPLOAD_ROOT, study_id)
        metadata_path = os.path.join(study_path, "metadata.json")
        if os.path.isfile(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            studies.append({"study_id": study_id, **metadata})
    return {"studies": studies}

# --- UPDATED get_study_instances ENDPOINT ---
@app.get("/studies/{study_id}/instances")
async def get_study_instances(study_id: str):
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    if not os.path.isdir(study_path):
        raise HTTPException(status_code=404, detail="Study not found")

    base_url = f"http://localhost:8000/uploads/{study_id}"

    # Get segmentation URL
    seg_path = os.path.join(study_path, "segmentation")
    seg_files = glob.glob(os.path.join(seg_path, "*.dcm"))
    seg_url = ""
    if seg_files:
        seg_url = f"dicomweb:{base_url}/segmentation/{os.path.basename(seg_files[0])}"
    
    # Load available classes from metadata.json
    metadata_path = os.path.join(study_path, "metadata.json")
    available_classes = []
    if os.path.isfile(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            available_classes = metadata.get("AvailableClasses", [])
            
    # THIS PART IS CHANGED
    # Determine the number of slices by counting the original DICOMs
    num_slices = len(glob.glob(os.path.join(study_path, "dicom_series", "*.dcm")))

    # Change image_urls to point to the new static PNGs
    image_urls = [
        f"{base_url}/previews/slice_{i:03d}.png" for i in range(num_slices)
    ]

    return {
        "study_id": study_id, # Also return the study_id for convenience
        "image_urls": image_urls,
        "seg_url": seg_url,
        "AvailableClasses": available_classes,
    }

# --- DELETED/COMMENTED OUT ENDPOINT ---
# The old get_slice_preview is no longer needed because the PNGs are now
# served directly by the StaticFiles middleware mounted at /uploads.
#
# @app.get("/studies/{study_id}/preview/{slice_index}")
# async def get_slice_preview(study_id: str, slice_index: int):
#     try:
#         dicom_path = os.path.join(UPLOAD_ROOT, study_id, "dicom_series", f"slice_{slice_index:03d}.dcm")
#         if not os.path.exists(dicom_path):
#             raise HTTPException(status_code=404, detail="DICOM slice not found")
# 
#         # Read DICOM with specific tags only
#         ds = pydicom.dcmread(dicom_path, stop_before_pixels=False, specific_tags=['PixelData'])
#         pixel_array = ds.pixel_array
# 
#         # Fast normalization using numpy operations
#         min_val = pixel_array.min()
#         max_val = pixel_array.max()
#         if max_val > min_val:
#             normalized = np.uint8(255 * ((pixel_array - min_val) / (max_val - min_val)))
#         else:
#             normalized = np.zeros(pixel_array.shape, dtype=np.uint8)
# 
#         # Create PIL image and compress
#         img = Image.fromarray(normalized)
#         img_io = io.BytesIO()
#         img.save(img_io, 'PNG', optimize=True, quality=85)
#         img_io.seek(0)
# 
#         return StreamingResponse(
#             img_io, 
#             media_type="image/png",
#             headers={
#                 'Cache-Control': 'max-age=3600',  # Cache for 1 hour
#                 'Content-Length': str(img_io.getbuffer().nbytes)
#             }
#         )
#     except Exception as e:
#         print(f"Error generating preview for slice {slice_index}: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))