import { ApiTags } from '@nestjs/swagger';
import { Get, Controller } from '@nestjs/common';

import { HomeService } from './home.service';

@ApiTags('Home')
@Controller()
export class HomeController {
  constructor(private service: HomeService) {}

  @Get()
  appInfo() {
    return this.service.appInfo();
  }
}
