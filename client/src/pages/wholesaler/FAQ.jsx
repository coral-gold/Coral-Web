import React from 'react';
import WholesalerLayout from '../../components/WholesalerLayout';
import FAQAccordion from '../../components/FAQAccordion';

const ITEMS = [
  {
    q: 'I forgot my password — what do I do?',
    a: "Contact us by call/WhatsApp. Only Admin can reset a party's password — there's no self-reset option.",
  },
  {
    q: 'How do I browse products?',
    a: 'After logging in, pick a category to see its products — each shows an image, Design Number, Jewel Code, Gross Weight, and Net Weight.',
  },
  {
    q: 'How do I add an item to my quotation?',
    a: 'Tap "Add" on any product card, or open the image preview and tap "Add to Quotation" there.',
  },
  {
    q: "Where do I see what I've added so far?",
    a: 'Tap the sticky "Generate Quotation" button anytime to see your current list.',
  },
  {
    q: 'Does the quotation show pricing?',
    a: 'No — it only lists item details (Design Number, Jewel Code, Gross/Net Weight, and your Remark if added). Price is always agreed separately.',
  },
  {
    q: 'How do I download my quotation?',
    a: "After generating it, tap Download for the PDF, or share it directly — it's ready to send to us right away.",
  },
  {
    q: 'Where can I see my past quotations?',
    a: 'Go to "My Quotations" anytime to view or re-download any previous quotation\'s PDF.',
  },
  {
    q: 'Can I change my own Party ID or password?',
    a: 'No — only Admin can view or change it. Contact us if you need it updated.',
  },
];

export default function FAQ() {
  return (
    <WholesalerLayout>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, color: 'var(--garnet)', marginBottom: 20 }}>
          FAQ
        </h1>
        <FAQAccordion items={ITEMS} />
      </div>
    </WholesalerLayout>
  );
}
