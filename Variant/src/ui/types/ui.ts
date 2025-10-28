/**
 * UI相关类型定义 - 基于H5tools提取
 */

export interface PopupProps {
  title?: string;
  popupStyle?: Record<string, any>;
  [key: string]: any;
}

export interface PopupListeners {
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onClose?: () => void;
  [key: string]: any;
}

export interface ComponentSize {
  width: number;
  height: number;
}

export interface ButtonConfig {
  text: string;
  type?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
}

export interface InputConfig {
  placeholder?: string;
  type?: 'text' | 'number' | 'email' | 'password';
  disabled?: boolean;
  readonly?: boolean;
  maxlength?: number;
}

export interface TabItem {
  name: string;
  component: any;
  disabled?: boolean;
}

// 组件相关类型
export interface ListItem {
  id: string;
  name: string;
  width: number;
  height: number;
  checked?: boolean;
}

export interface ConfigItem {
  id: string;
  platform: string;
  [key: string]: any;
}

export interface DataFileDropZoneProps {
  placeholder?: string;
  accept?: string[];
  multiple?: boolean;
}
