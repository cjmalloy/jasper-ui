import { removeTag, setPrivate, setProtected } from './tag';

describe('Tag Utils', () => {
  describe('removeTag', () => {
    it('should remove a single tag from array', () => {
      const tags = ['science', 'funny', 'news'];
      const result = removeTag('funny', tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should remove a tag and its parent tags', () => {
      const tags = ['science', 'people/murray/anne', 'news'];
      const result = removeTag('people/murray/anne', tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should remove hierarchical parent tags when removing child tag', () => {
      const tags = ['science', 'people', 'people/murray', 'people/murray/anne', 'news'];
      const result = removeTag('people/murray/anne', tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should handle undefined tag', () => {
      const tags = ['science', 'funny', 'news'];
      const result = removeTag(undefined, tags);
      expect(result).toEqual(['science', 'funny', 'news']);
    });

    it('should handle empty tags array', () => {
      const tags: string[] = [];
      const result = removeTag('science', tags);
      expect(result).toEqual([]);
    });

    it('should handle tag not in array', () => {
      const tags = ['science', 'funny', 'news'];
      const result = removeTag('sports', tags);
      expect(result).toEqual(['science', 'funny', 'news']);
    });

    // Tests for array of tags
    it('should remove multiple tags from array', () => {
      const tags = ['science', 'funny', 'news', 'sports'];
      const result = removeTag(['funny', 'sports'], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should remove multiple hierarchical tags', () => {
      const tags = ['science', 'people/murray/anne', 'people/smith/john', 'news'];
      const result = removeTag(['people/murray/anne', 'people/smith/john'], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should remove multiple tags with their parent tags', () => {
      const tags = ['science', 'people', 'people/murray', 'people/murray/anne', 'people/smith', 'people/smith/john', 'news'];
      const result = removeTag(['people/murray/anne', 'people/smith/john'], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should handle empty array of tags', () => {
      const tags = ['science', 'funny', 'news'];
      const result = removeTag([], tags);
      expect(result).toEqual(['science', 'funny', 'news']);
    });

    it('should handle array with undefined elements', () => {
      const tags = ['science', 'funny', 'news'];
      // Testing runtime behavior when array contains undefined (bypassing type check)
      const result = removeTag([undefined, 'funny', undefined] as unknown as string[], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should handle array with mix of valid and invalid tags', () => {
      const tags = ['science', 'funny', 'news', 'sports'];
      const result = removeTag(['funny', 'invalid', 'sports'], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should handle overlapping hierarchical tags in array', () => {
      const tags = ['people', 'people/murray', 'people/murray/anne', 'science', 'news'];
      const result = removeTag(['people/murray', 'people/murray/anne'], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should remove tags with common parent hierarchies', () => {
      const tags = ['people', 'people/murray', 'people/murray/anne', 'people/murray/bill', 'science'];
      const result = removeTag(['people/murray/anne', 'people/murray/bill'], tags);
      expect(result).toEqual(['science']);
    });

    it('should handle deep hierarchical tags', () => {
      const tags = ['a/b/c/d/e/f', 'science'];
      const result = removeTag('a/b/c/d/e/f', tags);
      expect(result).toEqual(['science']);
    });

    it('should not remove unrelated tags with similar prefixes', () => {
      const tags = ['science', 'scientist', 'science/physics'];
      const result = removeTag('science/physics', tags);
      // 'science' is removed because it's a parent of 'science/physics'
      // 'scientist' is kept because it's not a hierarchical tag
      expect(result).toEqual(['scientist']);
    });

    it('should handle array with duplicate tags', () => {
      const tags = ['science', 'funny', 'funny', 'news'];
      const result = removeTag('funny', tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should handle multiple removals of the same tag', () => {
      const tags = ['science', 'funny', 'news'];
      const result = removeTag(['funny', 'funny'], tags);
      expect(result).toEqual(['science', 'news']);
    });

    it('should preserve order of remaining tags', () => {
      const tags = ['zebra', 'science', 'apple', 'funny', 'news'];
      const result = removeTag('funny', tags);
      expect(result).toEqual(['zebra', 'science', 'apple', 'news']);
    });

    it('should handle tags with special prefixes', () => {
      const tags = ['_private', '+protected', 'public'];
      const result = removeTag('_private', tags);
      expect(result).toEqual(['+protected', 'public']);
    });

    it('should handle hierarchical tags with special prefixes', () => {
      const tags = ['_private/data', '_private', 'public'];
      const result = removeTag('_private/data', tags);
      expect(result).toEqual(['public']);
    });
  });

  describe('setPrivate', () => {
    it('should add private prefix to public tag', () => {
      const result = setPrivate('science');
      expect(result).toEqual('_science');
    });

    it('should handle already private tag', () => {
      const result = setPrivate('_science');
      expect(result).toEqual('_science');
    });

    it('should handle protected tag by converting to private', () => {
      const result = setPrivate('+science');
      expect(result).toEqual('_science');
    });

    it('should handle empty string', () => {
      const result = setPrivate('');
      expect(result).toEqual('');
    });

    it('should handle hierarchical tags', () => {
      const result = setPrivate('people/murray/anne');
      expect(result).toEqual('_people/murray/anne');
    });

    it('should handle hierarchical tags with existing private prefix', () => {
      const result = setPrivate('_people/murray/anne');
      expect(result).toEqual('_people/murray/anne');
    });

    it('should handle hierarchical tags with protected prefix', () => {
      const result = setPrivate('+people/murray/anne');
      expect(result).toEqual('_people/murray/anne');
    });

    it('should handle tags with origins', () => {
      const result = setPrivate('science@origin');
      expect(result).toEqual('_science@origin');
    });

    it('should handle tags with origins and existing prefix', () => {
      const result = setPrivate('_science@origin');
      expect(result).toEqual('_science@origin');
    });

    it('should handle nested tags', () => {
      const result = setPrivate('a/b/c/d/e');
      expect(result).toEqual('_a/b/c/d/e');
    });
  });

  describe('setProtected', () => {
    it('should add protected prefix to public tag', () => {
      const result = setProtected('science');
      expect(result).toEqual('+science');
    });

    it('should handle already protected tag', () => {
      const result = setProtected('+science');
      expect(result).toEqual('+science');
    });

    it('should handle private tag by converting to protected', () => {
      const result = setProtected('_science');
      expect(result).toEqual('+science');
    });

    it('should handle empty string', () => {
      const result = setProtected('');
      expect(result).toEqual('');
    });

    it('should handle hierarchical tags', () => {
      const result = setProtected('people/murray/anne');
      expect(result).toEqual('+people/murray/anne');
    });

    it('should handle hierarchical tags with existing protected prefix', () => {
      const result = setProtected('+people/murray/anne');
      expect(result).toEqual('+people/murray/anne');
    });

    it('should handle hierarchical tags with private prefix', () => {
      const result = setProtected('_people/murray/anne');
      expect(result).toEqual('+people/murray/anne');
    });

    it('should handle tags with origins', () => {
      const result = setProtected('science@origin');
      expect(result).toEqual('+science@origin');
    });

    it('should handle tags with origins and existing prefix', () => {
      const result = setProtected('+science@origin');
      expect(result).toEqual('+science@origin');
    });

    it('should handle nested tags', () => {
      const result = setProtected('a/b/c/d/e');
      expect(result).toEqual('+a/b/c/d/e');
    });
  });
});
