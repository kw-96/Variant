/**
 * 文件上传处理器
 * 负责处理图片、Excel、JSON/XML 等文件的上传和解析
 * 统一文件上传接口，供资源位、H5切图等板块复用
 */
import * as XLSX from 'xlsx';
import { cutImgToCanvas } from '../pages/create/imageSlicer';

/**
 * 文件上传结果（Excel/JSON）
 */
export interface FileUploadResult {
  data: any[];
  success: boolean;
  error?: string;
}

/**
 * 图片上传结果
 */
export interface ImageUploadResult {
  success: boolean;
  files: Array<{
    file: File;
    name: string;
    slices: Array<{
      img: Uint8Array;
      w: number;
      h: number;
      name: string;
      x: number;
      y: number;
    }>;
  }>;
  error?: string;
}

/**
 * 支持的图片格式
 */
const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'jfif'];

/**
 * 验证是否为图片文件
 */
function isValidImageFile(file: File): boolean {
  const names = file.name.split('.');
  const extension = names[names.length - 1]?.toLowerCase();
  return IMAGE_TYPES.indexOf(extension) !== -1;
}

/**
 * 处理 Excel 文件上传
 * @param file Excel 文件
 * @returns Promise<FileUploadResult>
 */
export async function handleExcelUpload(file: File): Promise<FileUploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 读取第一个工作表
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        
        // 转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(ws);
        
        resolve({
          data: jsonData as any[],
          success: true,
        });
      } catch (error) {
        console.error('Excel解析失败:', error);
        resolve({
          data: [],
          success: false,
          error: 'Excel文件解析失败，请检查文件格式',
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        data: [],
        success: false,
        error: '文件读取失败',
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 处理 JSON/XML 文件上传
 * @param file JSON/XML 文件
 * @returns Promise<FileUploadResult>
 */
export async function handleJsonFileUpload(file: File): Promise<FileUploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const jsonData = JSON.parse(text);
        
        const data = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        resolve({
          data,
          success: true,
        });
      } catch (error) {
        console.error('文件解析失败:', error);
        resolve({
          data: [],
          success: false,
          error: '文件解析失败，请检查文件格式',
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        data: [],
        success: false,
        error: '文件读取失败',
      });
    };
    
    reader.readAsText(file);
  });
}

/**
 * 处理图片文件上传
 * @param files 图片文件列表
 * @returns Promise<ImageUploadResult>
 */
export async function handleImageUpload(files: FileList | File[]): Promise<ImageUploadResult> {
  const fileArray = Array.from(files);
  const imageFiles = fileArray.filter(isValidImageFile);

  if (imageFiles.length === 0) {
    return {
      success: false,
      files: [],
      error: '没有有效的图片文件',
    };
  }

  const results: ImageUploadResult['files'] = [];

  try {
    for (const file of imageFiles) {
      const names = file.name.split('.');
      const nameWithoutExt = names.slice(0, -1).join('.');

      const { imgs, cuts } = await cutImgToCanvas(file);

      const slices = imgs.map((img, i) => ({
        img,
        w: cuts[i].w,
        h: cuts[i].h,
        name: cuts.length > 1 ? `${nameWithoutExt}-${i + 1}` : nameWithoutExt,
        x: cuts[i].x,
        y: cuts[i].y,
      }));

      results.push({
        file,
        name: nameWithoutExt,
        slices,
      });
    }

    return {
      success: true,
      files: results,
    };
  } catch (error) {
    console.error('图片处理失败:', error);
    return {
      success: false,
      files: [],
      error: '图片处理失败',
    };
  }
}

/**
 * 根据文件类型处理文件上传
 * @param file 文件对象
 * @returns Promise<FileUploadResult>
 */
export async function handleFileUploadByType(file: File): Promise<FileUploadResult> {
  const fileName = file.name.toLowerCase();
  
  // Excel 文件
  if (fileName.match(/\.(xlsx|csv)$/i)) {
    return await handleExcelUpload(file);
  }
  
  // JSON 文件
  if (fileName.match(/\.(json)$/i)) {
    return await handleJsonFileUpload(file);
  }
  
  // 不支持的文件类型
  return {
    data: [],
    success: false,
    error: '不支持的文件类型',
  };
}

