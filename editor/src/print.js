import {OpenSheetMusicDisplay} from 'opensheetmusicdisplay';
import {printScore} from './print-layout.js';

export function createPrinter(){
  const stage=document.createElement('div');stage.id='printHost';stage.setAttribute('aria-hidden','true');document.body.appendChild(stage);
  const layout=document.createElement('div');layout.id='printLayout';stage.appendChild(layout);
  const pages=document.createElement('div');pages.id='printPages';stage.appendChild(pages);
  const renderer=new OpenSheetMusicDisplay(layout,{backend:'svg',autoResize:false,drawTitle:true,drawComposer:true,drawPartNames:true,autoBeam:true,newSystemFromXML:true,newPageFromXML:false,stretchLastSystemLine:true});
  // US Letter landscape minus the browser's 0.4-inch page margins.
  renderer.setCustomPageFormat(259.08,195.58);
  let task=Promise.resolve();
  return {
    prepare(score){
      const doc=printScore(score);
      task=task.catch(()=>{}).then(async()=>{await renderer.load(doc);renderer.Zoom=.7;renderer.render();const output=[];for(const svg of layout.querySelectorAll('svg')){const page=document.createElement('div');page.className='print-page';page.appendChild(svg.cloneNode(true));output.push(page);}pages.replaceChildren(...output);return output.map(page=>page.firstChild.cloneNode(true));});
      return task;
    },
    async print(score){await this.prepare(score);if(!pages.children.length)throw Error('The printable score is not ready. Please try again.');window.print();},
    async pdf(score){
      const svgs=await this.prepare(score);
      if(!svgs?.length)throw Error('The printable score is not ready. Please try again.');
      const [{jsPDF}]=await Promise.all([import('jspdf'),import('svg2pdf.js')]);
      const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'letter',compress:true});
      for(let i=0;i<svgs.length;i++){
        if(i)pdf.addPage('letter','landscape');
        const svg=svgs[i];
        const width=Number(svg.getAttribute('width'))||svg.viewBox.baseVal.width;
        const height=Number(svg.getAttribute('height'))||svg.viewBox.baseVal.height;
        const scale=Math.min(259.08/width,195.58/height);
        await pdf.svg(svg,{x:10.16,y:10.16,width:width*scale,height:height*scale});
      }
      return pdf.output('blob');
    }
  };
}
