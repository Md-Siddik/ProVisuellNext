"use client"

import EditableText from "../dashboard/editor/EditableText"

export default function Intro() {
  return (
    <section id="intro" className="bg-paper py-20 sm:py-24 lg:py-28">
      <div className="page-shell text-center">
        <p className="mx-auto max-w-[800px] text-[18px] font-medium leading-8 text-neutral-800 sm:text-[21px]">
          <EditableText k="intro.description" />
        </p>
        <a href="#about" className="outline-button mt-9 border-black/[0.45] text-black">
          <EditableText k="intro.aboutCta" />
        </a>
      </div>
    </section>
  )
}