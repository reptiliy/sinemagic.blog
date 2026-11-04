// Copy only supported formatting into a fresh DOM tree.
function formattedText(html){
 const parsed=new DOMParser().parseFromString(html,'text/html');
 const output=document.createDocumentFragment();
 const allowed=new Set(['P','DIV','BR','STRONG','B','EM','I','U','H2','H3','UL','OL','LI','BLOCKQUOTE','A']);
 function copy(source,target){
  for(const node of source.childNodes){
   if(node.nodeType===Node.TEXT_NODE){target.append(document.createTextNode(node.textContent));continue}
   if(node.nodeType!==Node.ELEMENT_NODE||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName))continue;
   if(!allowed.has(node.tagName)){copy(node,target);continue}
   const next=document.createElement(node.tagName.toLowerCase());
   if(node.tagName==='A'){
    try{const url=new URL(node.getAttribute('href'),location.origin);if(['https:','http:'].includes(url.protocol)){next.href=url.href;next.rel='noopener noreferrer'}}catch{}
   }
   copy(node,next);target.append(next);
  }
 }
 copy(parsed.body,output);
 return output;
}
function plainParagraphs(text){
 const root=document.createElement('div');
 for(const paragraph of text.split(/\n\s*\n/)){const p=document.createElement('p');p.textContent=paragraph;root.append(p)}
 return root.innerHTML;
}
function parseContent(body){
 try{const doc=JSON.parse(body);if(doc?.format==='journal-v1')return doc}catch{}
 return {format:'journal-v1',cover:'',coverPosition:'center',blocks:[{type:'text',html:plainParagraphs(body||'')}]};
}
