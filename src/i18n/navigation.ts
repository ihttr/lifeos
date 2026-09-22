import { createNavigation } from "next-intl/navigation"

import { routing } from "./routing"

/** روابط وتنقّل واعية باللغة — استخدمها بدل next/link و next/navigation */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
