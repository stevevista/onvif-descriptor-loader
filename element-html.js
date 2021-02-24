'use strict';

const Element = require('./element');

class HTMLElement extends Element {
  constructor(nsName, attrs, options) {
    super(nsName, attrs, options);
  }

  renderHtml () {
    if (this.children.length === 0) {
      return `<${this.name}/>`;
    }
    let html = `<${this.name}>`;
    for (const el of this.children) {
      html += el.renderHtml();
    }
    html += `</${this.name}>`;
    return html;
  }
}

class HTMLTextElement extends HTMLElement {
  constructor(text) {
    super('__text__', {}, {});
    this.$value = text
  }

  renderHtml () {
    return this.$value;
  }
}

module.exports = {
  HTMLElement,
  HTMLTextElement
};
