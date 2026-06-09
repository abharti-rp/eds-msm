/* eslint-disable no-console */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { isAuthorEnvironment, moveInstrumentation, moveAttributes } from '../../scripts/scripts.js';

const configObj = {
  AUTHOR_PATH: 'https://author-p133739-e1306963.adobeaemcloud.com',
  PUBLISH_PATH: 'https://publish-p133739-e1306963.adobeaemcloud.com',
  GRAPHQL_BASE: '/graphql/execute.json/global/article-by-path-variation%3BarticlePath%3D',
  VARIATION: '%3Bvariation%3D',
};

async function fetchContentFragmentData(cfPath) {
  const response = await fetch(cfPath, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data;
}

export default function decorate(block) {
  const isAuthor = isAuthorEnvironment();
  [...block.children].forEach((row) => {
    const articleEle = document.createElement('article');
    articleEle.className = 'cf-wrapper';
    let cfPath = row.querySelector('div a')?.textContent?.trim();
    const variation = row.querySelector('div:nth-child(2)')?.textContent?.trim();
    if (cfPath) {
      const baseUrl = isAuthor ? configObj.AUTHOR_PATH : configObj.PUBLISH_PATH;
      cfPath = baseUrl + configObj.GRAPHQL_BASE + encodeURI(cfPath);
      if (variation) {
        cfPath = cfPath + configObj.VARIATION + encodeURI(variation);
      }
    }
    moveInstrumentation(row, articleEle);
    moveAttributes(row, articleEle);
    row.replaceWith(articleEle);
    fetchContentFragmentData(cfPath)
      .then((resp) => {
        console.log(resp);
        const data = resp.data.edsArticleModelByPath.item;
        const titleEle = document.createElement('h3');
        const descriptionEle = document.createElement('p');
        if (data.articleBannerPath) {
          const optimizedPic = createOptimizedPicture(data.articleBannerPath, data.articleTitle, false, [{ width: '750' }]);
          articleEle.append(optimizedPic);
        }
        if (data.articleTitle) {
          titleEle.innerText = data.articleTitle;
          articleEle.append(titleEle);
        }
        if (data.articleDescription) {
          descriptionEle.innerText = data.articleDescription;
          articleEle.append(descriptionEle);
        }
      })
      .catch((err) => {
        console.error(err);
        const errorEle = document.createElement('p');
        errorEle.innerHTML = 'Something went wrong!';
        errorEle.className = 'cf-error';
        articleEle.append(errorEle);
      });
  });
}
