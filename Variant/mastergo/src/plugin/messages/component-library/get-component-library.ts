import { MessageType, sendMsgToUI } from '../../../../../src/messages';

interface ComponentInfo {
  id: string;
  name: string;
  ukey: string;
  description: string;
  type: "COMPONENT" | "COMPONENT_SET";
  cover: string;
  width: number;
  height: number;
  libraryName: string;
  category: string; // 分类字段
}

async function handler() {
  try {

    const teamLibraries = await mg.getTeamLibraryAsync();
    const resourceLibraries = (Array.isArray(teamLibraries) ? teamLibraries : []).filter((lib: any) => {
      const libName = String(lib?.name || '');
      return libName.indexOf('资源位') >= 0;
    });

    if (!teamLibraries || !Array.isArray(teamLibraries) || teamLibraries.length === 0) {
      sendMsgToUI(MessageType.SHOW_NOTIFY, { message: '未订阅任何团队库', timeout: 2000 });
      sendMsgToUI(MessageType.GET_COMPONENT_LIBRARY, { components: [] }); // 发送空列表
      return;
    }
    if (resourceLibraries.length === 0) {
      sendMsgToUI(MessageType.SHOW_NOTIFY, { message: '未找到名称包含“资源位”的团队库', timeout: 2500 });
      sendMsgToUI(MessageType.GET_COMPONENT_LIBRARY, { components: [] });
      return;
    }

    const allComponents: ComponentInfo[] = [];
    
    for (const lib of resourceLibraries) {
        if (!lib) continue;
        
        // 防御性获取库名
        const libName = lib.name ? String(lib.name).trim() : '未命名库';
        
        if (lib.componentList && Array.isArray(lib.componentList) && lib.componentList.length > 0) {
            lib.componentList.forEach((comp: any) => {
                if (!comp) return;

                allComponents.push({
                    id: comp.id ? String(comp.id) : '',
                    name: comp.name ? String(comp.name).trim() : '未命名组件',
                    ukey: comp.ukey ? String(comp.ukey) : '',
                    description: comp.description ? String(comp.description).trim() : '',
                    type: comp.type || 'COMPONENT',
                    cover: comp.cover ? String(comp.cover) : '',
                    width: Number(comp.width) || 0,
                    height: Number(comp.height) || 0,
                    libraryName: libName,
                    category: libName, // 确保使用字符串库名
                });
            });
        }
    }
    
    if (allComponents.length === 0) {
      sendMsgToUI(MessageType.SHOW_NOTIFY, { message: '团队库中暂无组件', timeout: 2000 });
      sendMsgToUI(MessageType.GET_COMPONENT_LIBRARY, { components: [] }); 
      return;
    }

    sendMsgToUI(MessageType.GET_COMPONENT_LIBRARY, { components: allComponents });
    
  } catch (error: any) {
    const errorMsg = error?.message || '未知错误';
    sendMsgToUI(MessageType.SHOW_NOTIFY, { message: `获取组件列表失败: ${errorMsg}`, timeout: 3000 });
    sendMsgToUI(MessageType.GET_COMPONENT_LIBRARY, { components: [] }); // 确保发送空列表以关闭 loading
  }
}

export default {
  type: MessageType.GET_COMPONENT_LIBRARY,
  handler,
};

