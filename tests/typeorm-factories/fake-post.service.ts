import {SequelizeFakeEntityService, TypeormFakeEntityService} from '../../src';
import { FakeUserService } from './fake-user.service';
import {faker} from '@faker-js/faker';
import {FakeCommentService} from "./fake-comment.service";
import {Repository} from "typeorm";
import {Post} from "../typeorm-models/post.entity";

export class FakePostService extends TypeormFakeEntityService<Post> {
  constructor(
    public repository: Repository<Post>,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<Post> {
    return {
      message: faker.lorem.sentence()
    }
  }

  withParentUser(fakeUserService: FakeUserService, each = false, userFields?: Partial<Post>): FakePostService {
    return this.withParent(fakeUserService,
      {
        parent: 'id',
        nested: 'userId'
      },
      each,
      userFields) as FakePostService;
  }

  withComments(fakeCommentService: FakeCommentService, count = 1, commentFields?: Partial<Comment>): FakePostService {
    return this.withNested(
      fakeCommentService,
      {
        parent: 'id',
        nested: 'postId'
      },
      count,
      commentFields) as FakePostService;
  }


}