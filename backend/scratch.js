const pdfmake = require('pdfmake');
const fs = require('fs');
const path = require('path');

async function test() {
  try {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    pdfmake.setFonts(fonts);
    
    const imagePath = path.join(__dirname, '../dashboard/public/logo.png');
    console.log('Image path:', imagePath);

    const docDefinition = {
      defaultStyle: { font: 'Helvetica' },
      content: [
        'Hello PDF from new API',
        { image: imagePath, width: 50 }
      ]
    };
    
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();
    
    fs.writeFileSync('test3.pdf', buffer);
    console.log('PDF created successfully (test3.pdf)');
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
