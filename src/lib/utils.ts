import { createCn } from "cn/config"

// Class merging must know the custom type scale from globals.css: otherwise
// `text-button` is taken for a color and dropped next to `text-primary-foreground`
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["eyebrow", "title", "lead", "card-title", "name", "button"] },
      ],
    },
  },
})
