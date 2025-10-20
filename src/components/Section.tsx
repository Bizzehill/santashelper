import type { ReactNode } from 'react'

type Props = {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  headingLevel?: 'h2' | 'h3'
}

export default function Section({ title, description, children, className = '', headingLevel = 'h2' }: Props) {
  const Heading = headingLevel
  return (
    <section className={`card py-12 px-6 ${className}`}>
      {title ? <Heading className="m-0 mb-3 text-2xl font-bold">{title}</Heading> : null}
      {description ? <p className="m-0 mb-4 text-lg leading-relaxed text-gray-300">{description}</p> : null}
      {children}
    </section>
  )}
