import { faker } from '@faker-js/faker';
import { SequelizeFakeEntityService } from '../../src';
import { Comment } from '../sequelize-models/comment.entity';
import { FakePostService } from './fake-post.service';
import { FakeUserService } from './fake-user.service';
import {Post} from "../sequelize-models/post.entity";
import {User} from "../sequelize-models/user.entity";


export class FakeCommentService extends SequelizeFakeEntityService<Comment> {
  constructor(
    public repository: typeof Comment,
  ) {
    super(repository);
  }

  protected setFakeFields(): Partial<Comment> {
    return {
      postId: faker.datatype.number(),
      userId: faker.datatype.number(),
      message: faker.lorem.sentence(),
      createdAt: faker.date.recent(),
    };
  }

  withParentPost(fakePostService: FakePostService, postFields?: Partial<Post>, each = false): FakeCommentService {
    this.parentEntities.push({
      service: fakePostService,
      each,
      customFields: postFields,
      relationFields: {
        parent: 'id',
        nested: 'postId'
      }
    });
    return this;
  }

  withParentUser(fakeUserService: FakeUserService, userFields?: Partial<User>, each = false): FakeCommentService {
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
}
