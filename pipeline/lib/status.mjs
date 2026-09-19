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
  const citable =
    page.badges.length + page.bundle_components.length + page.description.bullets.length + page.specifics.length;
  if (citable === 0) {
    return {
      status: 'to_confirm',
      rule: 'no-attribute-to-cite',
      reason:
        'The page carries description prose but no attribute a line could cite: no age or format badge, no listed contents, no attribute table.',
    };
  }
  return {
    status: 'proposal',
    rule: 'block-absent-and-attributes-present',
    reason: 'The block is absent and the page carries attributes a line can cite.',
  };
}
