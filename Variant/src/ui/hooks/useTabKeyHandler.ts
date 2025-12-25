import { Ref } from 'vue';

/**
 * 处理 textarea 中 Tab 键插入制表符的 composable
 * @param textRef 文本内容的 ref
 * @returns handleKeydown 事件处理函数
 */
export function useTabKeyHandler(textRef: Ref<string>) {
  /**
   * 处理键盘事件（使 Tab 键插入制表符而不是切换焦点）
   */
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault(); // 阻止默认的焦点切换行为
      
      const textarea = event.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textRef.value;
      
      // 在光标位置插入 Tab 字符
      const newText = text.substring(0, start) + '\t' + text.substring(end);
      textRef.value = newText;
      
      // 恢复光标位置（插入 Tab 后，光标应该在 Tab 字符之后）
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }, 0);
    }
  }

  return {
    handleKeydown,
  };
}

