// The status of a page in the batch follows from what the page showed, in this order.
// No status is decided by hand, and none is filled in ahead of the reading.

export const STATUSES = ['proposal', 'no_change', 'to_confirm'];

export function decideStatus(page) {
  if (!page.served_product_page) {
    return {
      status: 'to_confirm',
      rule: 'page-not-served',
      reason: 'The request for this product did not return a product page in the observed market.',
    };
  }
  if (page.highlights.present) {
    return {
      status: 'no_change',
      rule: 'block-already-present',
      reason: `The block is already on the page, with ${page.highlights.count} lines.`,
    };
  }
  // This counts structured fields only. It says nothing about the description, so it
  // reports what was not found rather than ruling that there is nothing to cite.
  const structured =
    page.badges.length + page.bundle_components.length + page.description.bullets.length + page.specifics.length;
  if (structured === 0) {
    const template = (page.feed?.product_type || 'product').trim().toLowerCase().replace(/\s+/g, '-');
    return {
      status: 'to_confirm',
      rule: 'no-structured-attribute-found',
      reason: `No separate attributes were found in the extracted badges, lists or tables. No highlights are proposed for this ${template} template. Please confirm whether it should carry a separate highlights block.`,
    };
  }
  return {
    status: 'proposal',
    rule: 'block-absent-and-attributes-present',
    reason: 'The block is absent and the page carries attributes a line can cite.',
  };
}
