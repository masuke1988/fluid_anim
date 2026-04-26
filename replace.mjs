import { writeFileSync, readFileSync } from 'fs';
import {glob} from 'glob';

const replaceInHtmlFiles = () => {
  try {
    const files = glob.sync('dist/**/*.{html,css}');
    for (const file of files) {
      // htmlファイルの読み込み
      const data = readFileSync(file, 'utf8');
      const depth = file.split('/').length - 1; 
      console.log(file, depth);
      let relativePath = './'; // デフォルトは同一ディレクトリ
      if (depth > 1) {
        // ファイルがサブディレクトリにある場合、適切な数の `../` を使用
        relativePath = '../'.repeat(depth - 1);
      }

      if(file.match(/\.css$/)) {
        const result = data.replace(/url\(\/(.*?)\)/g, `url(${relativePath}$1)`)
        writeFileSync(file, result, 'utf8');
      } else if(file.match(/\.html$/)){
        // htmlファイルの場合、相対パスを置換

        if(file.match(/en/)) {
          const result = data
            .replace(/rel="stylesheet" href="\/(.*?)"/g, `rel="stylesheet" href="${relativePath}$1"`)
            .replace(/src="\/(.*?)"/g, `src="${relativePath}$1"`)
            .replace(/srcset="\/(.*?)"/g, `srcset="${relativePath}$1"`)
            .replace(/<a href="\/(.*?)" data-astro-cid-py6iswdg>JP<\/a>/g, `<a href="${relativePath}$1" data-astro-cid-py6iswdg>JP</a>`)
            .replace(/href="\/en\/(.*?)"/g, `href="${relativePath = '../'.repeat(depth - 2)}$1"`)
          writeFileSync(file, result, 'utf8');
        } else {
          const result = data
            .replace(/href="\/(.*?)"/g, `href="${relativePath}$1"`)
            .replace(/src="\/(.*?)"/g, `src="${relativePath}$1"`)
            .replace(/srcset="\/(.*?)"/g, `srcset="${relativePath}$1"`)
            .replace(/poster="\/(.*?)"/g, `poster="${relativePath}$1"`)
          writeFileSync(file, result, 'utf8');
        }
      }
    }

    console.log('Replace in html, css files done');
  } catch (error) {
    console.log(error);
  }
};

replaceInHtmlFiles();