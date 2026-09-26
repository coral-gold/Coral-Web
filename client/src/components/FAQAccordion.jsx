import React, { useState } from 'react';

// Shared accordion used by the Public, Wholesaler and Admin FAQ pages
// (Batch 31) — each passes its own {q, a} list, only one answer open at a
// time per instance. Kept content-agnostic so each area's FAQ page just
// supplies its own array and wraps it in whatever layout/section chrome
// fits that area's existing style.
export default function FAQAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="faq-accordion">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={`faq-item${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="faq-question"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <span className="faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <div className="faq-answer">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
