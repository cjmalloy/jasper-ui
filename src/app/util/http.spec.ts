import { HttpErrorResponse } from '@angular/common/http';
import { printError } from './http';
import { Problem } from '../model/problem';

describe('http utilities', () => {
  describe('printError', () => {
    it('should handle fieldErrors', () => {
      const problem: Problem = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        path: '/api/v1/ref',
        message: 'Validation failed',
        fieldErrors: [
          { objectName: 'Ref', field: 'url', message: 'must not be blank' }
        ]
      };
      const response = new HttpErrorResponse({
        error: problem,
        status: 400,
        statusText: 'Bad Request'
      });
      
      const result = printError(response);
      expect(result).toEqual(['Error: Ref url must not be blank']);
    });

    it('should handle violations', () => {
      const problem: Problem = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        path: '/api/v1/ref',
        message: 'Validation failed',
        violations: [
          { objectName: 'Ref', field: 'tags', message: 'must not be empty' }
        ]
      };
      const response = new HttpErrorResponse({
        error: problem,
        status: 400,
        statusText: 'Bad Request'
      });
      
      const result = printError(response);
      expect(result).toEqual(['Error: tags must not be empty']);
    });

    it('should parse plugin validation errors with instance path', () => {
      const problem: Problem = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        path: '/api/v1/ref',
        message: 'Invalid plugin/feed: [ValidationError [instancePath=[scrapeEmbed], schemaPath=[]]] plugin.'
      };
      const response = new HttpErrorResponse({
        error: problem,
        status: 400,
        statusText: 'Bad Request'
      });
      
      const result = printError(response);
      expect(result).toEqual(["Error in plugin/feed: Invalid field 'scrapeEmbed'"]);
    });

    it('should parse plugin validation errors without instance path', () => {
      const problem: Problem = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        path: '/api/v1/ref',
        message: 'Invalid plugin/test: [ValidationError [instancePath=[], schemaPath=[]]] plugin.'
      };
      const response = new HttpErrorResponse({
        error: problem,
        status: 400,
        statusText: 'Bad Request'
      });
      
      const result = printError(response);
      expect(result).toEqual(['Error in plugin/test: Validation failed']);
    });

    it('should use detail field if message is not available', () => {
      const problem: Problem = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        path: '/api/v1/ref',
        message: '',
        detail: 'Invalid plugin/custom: [ValidationError [instancePath=[someField], schemaPath=[]]] plugin.'
      };
      const response = new HttpErrorResponse({
        error: problem,
        status: 400,
        statusText: 'Bad Request'
      });
      
      const result = printError(response);
      expect(result).toEqual(["Error in plugin/custom: Invalid field 'someField'"]);
    });

    it('should return plain message when no special format is detected', () => {
      const problem: Problem = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        path: '/api/v1/ref',
        message: 'Something went wrong'
      };
      const response = new HttpErrorResponse({
        error: problem,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      const result = printError(response);
      expect(result).toEqual(['Something went wrong']);
    });

    it('should fallback to response message if problem is not available', () => {
      const response = new HttpErrorResponse({
        error: null,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      const result = printError(response);
      expect(result).toEqual(['Http failure response for (unknown url): 500 Internal Server Error']);
    });
  });
});
