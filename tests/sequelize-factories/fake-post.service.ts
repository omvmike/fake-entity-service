import { SequelizeFakeEntityService } from '../../src';
import { Post } from '../sequelize-models/post.entity';
import { FakeUserService } from './fake-user.service';
import {faker} from '@faker-js/faker';
import {User} from "../sequelize-models/user.entity";
import {FakeCommentService} from "./fake-comment.service";

export class FakePostService extends SequelizeFakeEntityService<Post> {
  constructor(
    public repository: typeof Post,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<Post> {
    return {
      message: faker.lorem.sentence()
    }
  }

  withParentUser(fakeUserService: FakeUserService, userFields?: Partial<Post>, each = false): FakePostService {
    this.parentEntities.push({
      service: fakeUserService,
      each,
      customFields: userFields,
      relationFields: {
        parent: 'id',
        nested: 'userId'
      }
    });
    return this;
  }

  withComments(fakeCommentService: FakeCommentService, count = 1, commentFields?: Partial<Comment>): FakePostService {
    this.nestedEntities.push({
      service: fakeCommentService,
      count,
      customFields: commentFields,
      relationFields: {
        parent: 'id',
        nested: 'postId'
      }
    });
    return this;
  }


}