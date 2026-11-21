export const colors={green:'#08752D',greenDark:'#075C26',greenSoft:'#E8F6E1',lime:'#DFF3D2',background:'#F5F7F5',surface:'#FFFFFF',text:'#172119',muted:'#6E786F',line:'#E6EAE6',danger:'#D22E40',amber:'#AF7200',amberSoft:'#FFF3D2'}
export const money=(value:number|string)=>`$ ${Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
