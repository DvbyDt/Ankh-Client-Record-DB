# Fix Instructions

The page.tsx file has duplicate closing tags in the search results section. 

Around lines 888-936, there are duplicate `</>`, `)}`, `</TableBody>`, `</Table>`, and `</div>` tags.

The correct structure should be:

1. For customer search type:
   - Initial Condition Table (with TableBody and Table tags)
   - Lesson Details Table (with TableBody and Table tags)
   - Close the customer conditional `</>`  and `)}` 

2. For instructor search type:
   - Customers Trained Table (with TableBody and Table tags)
   - Close the instructor conditional `)}` 

3. Close the expanded TableCell

The instructor table section is being added TWICE due to the patching issue. Lines 893-936 contain duplicate structures.

To fix: Delete lines 893-936 (the duplicate instructor table and closing tags that appear before line 937).
